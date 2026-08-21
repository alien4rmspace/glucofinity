import AVFoundation
import ExpoModulesCore
import Foundation
import Speech

public final class GlucofinitySpeechModule: Module {
  private var legacyRecognitionTask: SFSpeechRecognitionTask?
  private var liveAudioEngine: AVAudioEngine?
  private var liveRecognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var latestLiveTranscript = ""
  private var liveLocaleIdentifier = Locale.current.identifier
  private var liveTapInstalled = false
  private var liveAudioInputFinished = false

  public func definition() -> ModuleDefinition {
    Name("GlucofinitySpeech")

    Events("onLiveTranscript")

    OnDestroy {
      Task { @MainActor [weak self] in
        self?.stopLiveRecognition(cancelTask: true)
      }
    }

    AsyncFunction("getAvailabilityAsync") { (localeIdentifier: String) async -> [String: Any] in
      await self.availability(localeIdentifier: localeIdentifier)
    }

    AsyncFunction("transcribeFileAsync") { (fileUri: String, localeIdentifier: String) async throws -> [String: Any] in
      let locale = Locale(identifier: localeIdentifier)
      let url = try self.validatedFileURL(fileUri)

      if #available(iOS 26.0, *),
        SpeechTranscriber.isAvailable,
        let supportedLocale = await SpeechTranscriber.supportedLocale(equivalentTo: locale) {
        let transcript = try await self.transcribeWithSpeechAnalyzer(
          url: url,
          locale: supportedLocale
        )
        return [
          "transcript": transcript,
          "engine": "speech-analyzer",
          "locale": supportedLocale.identifier
        ]
      }

      let transcript = try await self.transcribeWithLegacySpeech(url: url, locale: locale)
      return [
        "transcript": transcript,
        "engine": "sf-speech-on-device",
        "locale": locale.identifier
      ]
    }

    AsyncFunction("startLiveTranscriptionAsync") { (localeIdentifier: String) async throws -> Void in
      try await self.startLiveTranscription(localeIdentifier: localeIdentifier)
    }

    AsyncFunction("stopLiveTranscriptionAsync") { () async throws -> [String: Any] in
      try await self.stopLiveTranscription()
    }

    AsyncFunction("cancelLiveTranscriptionAsync") { () async -> Void in
      await self.cancelLiveTranscription()
    }
  }

  @MainActor
  private func startLiveTranscription(localeIdentifier: String) async throws {
    self.stopLiveRecognition(cancelTask: true)
    let locale = Locale(identifier: localeIdentifier)
    guard let recognizer = SFSpeechRecognizer(locale: locale),
      recognizer.supportsOnDeviceRecognition else {
      throw speechError(code: 3, message: "On-device Apple speech recognition is unavailable for this locale.")
    }

    let authorizationStatus = await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { status in
        continuation.resume(returning: status)
      }
    }
    guard authorizationStatus == .authorized else {
      throw speechError(code: 4, message: "Speech recognition permission was not granted.")
    }

    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.record, mode: .measurement, options: [])
    try audioSession.setActive(true)
    guard audioSession.isInputAvailable else {
      try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
      throw speechError(code: 7, message: "No microphone input is currently available.")
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.requiresOnDeviceRecognition = true
    request.shouldReportPartialResults = true
    request.taskHint = .dictation
    request.contextualStrings = [
      "carbohydrates", "protein", "fiber", "glucose", "brown rice",
      "white rice", "salmon", "lettuce", "broccoli", "oatmeal",
      "grams", "ounces", "tablespoons", "teaspoons"
    ]

    let audioEngine = AVAudioEngine()
    let inputNode = audioEngine.inputNode
    let hardwareInputFormat = inputNode.inputFormat(forBus: 0)
    guard hardwareInputFormat.sampleRate > 0, hardwareInputFormat.channelCount > 0 else {
      try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
      throw speechError(code: 7, message: "The microphone audio format is unavailable.")
    }

    self.latestLiveTranscript = ""
    self.liveLocaleIdentifier = locale.identifier
    self.liveAudioInputFinished = false
    self.liveRecognitionRequest = request
    self.liveAudioEngine = audioEngine
    self.legacyRecognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
      Task { @MainActor in
        guard let self else { return }
        if let result {
          let transcript = result.bestTranscription.formattedString
            .trimmingCharacters(in: .whitespacesAndNewlines)
          if !transcript.isEmpty {
            let accumulatedTranscript = self.mergeLiveTranscript(
              existing: self.latestLiveTranscript,
              incoming: transcript
            )
            self.latestLiveTranscript = accumulatedTranscript
            self.sendEvent("onLiveTranscript", [
              "transcript": accumulatedTranscript,
              "isFinal": result.isFinal
            ])
          }
        }
        if error != nil {
          self.finishLiveAudioInput()
        }
      }
    }

    // Passing nil lets AVAudioEngine retain the active hardware format. Apple
    // documents that a non-nil, mismatched tap format can fail at this boundary.
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: nil) { buffer, _ in
      request.append(buffer)
    }
    self.liveTapInstalled = true
    audioEngine.prepare()
    do {
      try audioEngine.start()
    } catch {
      self.stopLiveRecognition(cancelTask: true)
      throw error
    }
  }

  @MainActor
  private func stopLiveTranscription() async throws -> [String: Any] {
    guard self.liveAudioEngine != nil, self.liveRecognitionRequest != nil else {
      throw speechError(code: 6, message: "No live transcription is in progress.")
    }

    self.finishLiveAudioInput()
    try await Task.sleep(nanoseconds: 700_000_000)
    defer { self.stopLiveRecognition(cancelTask: false) }
    let transcript = try self.validatedTranscript(self.latestLiveTranscript)
    return [
      "transcript": transcript,
      "engine": "sf-speech-on-device",
      "locale": self.liveLocaleIdentifier
    ]
  }

  @MainActor
  private func cancelLiveTranscription() {
    self.stopLiveRecognition(cancelTask: true)
  }

  @MainActor
  private func finishLiveAudioInput() {
    guard !self.liveAudioInputFinished, let audioEngine = self.liveAudioEngine else { return }
    self.liveAudioInputFinished = true
    audioEngine.stop()
    if self.liveTapInstalled {
      audioEngine.inputNode.removeTap(onBus: 0)
      self.liveTapInstalled = false
    }
    self.liveRecognitionRequest?.endAudio()
  }

  @MainActor
  private func stopLiveRecognition(cancelTask: Bool) {
    self.finishLiveAudioInput()
    if cancelTask {
      self.legacyRecognitionTask?.cancel()
    } else {
      self.legacyRecognitionTask?.finish()
    }
    self.legacyRecognitionTask = nil
    self.liveRecognitionRequest = nil
    self.liveAudioEngine = nil
    self.liveTapInstalled = false
    self.liveAudioInputFinished = false
    try? AVAudioSession.sharedInstance().setActive(
      false,
      options: .notifyOthersOnDeactivation
    )
  }

  private func mergeLiveTranscript(existing: String, incoming: String) -> String {
    let normalizedExisting = existing
      .split(whereSeparator: { $0.isWhitespace })
      .joined(separator: " ")
    let normalizedIncoming = incoming
      .split(whereSeparator: { $0.isWhitespace })
      .joined(separator: " ")
    if normalizedExisting.isEmpty { return normalizedIncoming }
    if normalizedIncoming.isEmpty { return normalizedExisting }

    let existingWords = self.comparisonWords(normalizedExisting)
    let incomingWords = self.comparisonWords(normalizedIncoming)
    if existingWords.isEmpty { return normalizedIncoming }
    if incomingWords.isEmpty { return normalizedExisting }
    if incomingWords.starts(with: existingWords) { return normalizedIncoming }
    if existingWords.starts(with: incomingWords) { return normalizedExisting }

    let maximumOverlap = min(existingWords.count, incomingWords.count)
    if maximumOverlap > 0 {
      for overlap in stride(from: maximumOverlap, through: 1, by: -1) {
        if Array(existingWords.suffix(overlap)) == Array(incomingWords.prefix(overlap)) {
          let originalIncomingWords = normalizedIncoming
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
          let remainder = originalIncomingWords.dropFirst(overlap).joined(separator: " ")
          return remainder.isEmpty ? normalizedExisting : "\(normalizedExisting) \(remainder)"
        }
      }
    }

    var sharedPrefixLength = 0
    while sharedPrefixLength < maximumOverlap &&
      existingWords[sharedPrefixLength] == incomingWords[sharedPrefixLength] {
      sharedPrefixLength += 1
    }
    if sharedPrefixLength >= 2 {
      // The recognizer revised an unstable partial result from the same phrase.
      return normalizedIncoming
    }

    // A pause can make the recognizer begin a fresh phrase. Keep the completed
    // words instead of replacing them with only the new partial result.
    return "\(normalizedExisting) \(normalizedIncoming)"
  }

  private func comparisonWords(_ value: String) -> [String] {
    value
      .lowercased()
      .split(whereSeparator: { $0.isWhitespace })
      .map { String($0).trimmingCharacters(in: .punctuationCharacters) }
      .filter { !$0.isEmpty }
  }

  private func availability(localeIdentifier: String) async -> [String: Any] {
    let locale = Locale(identifier: localeIdentifier)

    if #available(iOS 26.0, *), SpeechTranscriber.isAvailable {
      if let supportedLocale = await SpeechTranscriber.supportedLocale(equivalentTo: locale) {
        return [
          "status": "available",
          "engine": "speech-analyzer",
          "locale": supportedLocale.identifier,
          "message": "Apple on-device transcription is available. Language assets may download before first use."
        ]
      }
    }

    guard let recognizer = SFSpeechRecognizer(locale: locale) else {
      return [
        "status": "unsupported-locale",
        "locale": locale.identifier,
        "message": "Apple speech recognition does not support this locale on this device."
      ]
    }

    guard recognizer.supportsOnDeviceRecognition else {
      return [
        "status": "on-device-unavailable",
        "locale": locale.identifier,
        "message": "This device cannot transcribe this locale fully on-device."
      ]
    }

    switch SFSpeechRecognizer.authorizationStatus() {
    case .denied, .restricted:
      return [
        "status": "permission-denied",
        "engine": "sf-speech-on-device",
        "locale": locale.identifier,
        "message": "Speech recognition permission is unavailable."
      ]
    default:
      return [
        "status": "available",
        "engine": "sf-speech-on-device",
        "locale": locale.identifier,
        "message": "Apple on-device transcription is available."
      ]
    }
  }

  private func validatedFileURL(_ fileUri: String) throws -> URL {
    guard let url = URL(string: fileUri), url.isFileURL else {
      throw speechError(code: 1, message: "A local audio recording is required.")
    }
    guard FileManager.default.fileExists(atPath: url.path) else {
      throw speechError(code: 2, message: "The recorded audio file is no longer available.")
    }
    return url
  }

  @available(iOS 26.0, *)
  private func transcribeWithSpeechAnalyzer(url: URL, locale: Locale) async throws -> String {
    let transcriber = SpeechTranscriber(locale: locale, preset: .transcription)
    if let installationRequest = try await AssetInventory.assetInstallationRequest(
      supporting: [transcriber]
    ) {
      try await installationRequest.downloadAndInstall()
    }

    let audioFile = try AVAudioFile(forReading: url)
    let analyzer = SpeechAnalyzer(modules: [transcriber])
    let resultTask = Task<String, Error> {
      var phrases: [String] = []
      for try await result in transcriber.results {
        let phrase = String(result.text.characters)
          .trimmingCharacters(in: .whitespacesAndNewlines)
        if !phrase.isEmpty {
          phrases.append(phrase)
        }
      }
      return phrases.joined(separator: " ")
    }

    do {
      let lastSampleTime = try await analyzer.analyzeSequence(from: audioFile)
      if let lastSampleTime {
        try await analyzer.finalizeAndFinish(through: lastSampleTime)
      } else {
        await analyzer.cancelAndFinishNow()
      }
      let collectedTranscript = try await resultTask.value
      return try validatedTranscript(collectedTranscript)
    } catch {
      await analyzer.cancelAndFinishNow()
      resultTask.cancel()
      throw error
    }
  }

  private func transcribeWithLegacySpeech(url: URL, locale: Locale) async throws -> String {
    guard let recognizer = SFSpeechRecognizer(locale: locale),
      recognizer.supportsOnDeviceRecognition else {
      throw speechError(
        code: 3,
        message: "On-device Apple speech recognition is unavailable for this locale."
      )
    }

    let authorizationStatus = await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { status in
        continuation.resume(returning: status)
      }
    }
    guard authorizationStatus == .authorized else {
      throw speechError(
        code: 4,
        message: "Speech recognition permission was not granted."
      )
    }

    let request = SFSpeechURLRecognitionRequest(url: url)
    request.requiresOnDeviceRecognition = true
    request.shouldReportPartialResults = false
    request.taskHint = .dictation
    request.contextualStrings = [
      "carbohydrates", "protein", "fiber", "glucose", "breakfast",
      "lunch", "dinner", "snack"
    ]

    return try await withCheckedThrowingContinuation { continuation in
      var completed = false
      self.legacyRecognitionTask = recognizer.recognitionTask(with: request) { result, error in
        guard !completed else { return }
        if let result, result.isFinal {
          completed = true
          self.legacyRecognitionTask = nil
          do {
            continuation.resume(
              returning: try self.validatedTranscript(
                result.bestTranscription.formattedString
              )
            )
          } catch {
            continuation.resume(throwing: error)
          }
        } else if let error {
          completed = true
          self.legacyRecognitionTask = nil
          continuation.resume(throwing: error)
        }
      }
    }
  }

  private func validatedTranscript(_ value: String) throws -> String {
    let transcript = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !transcript.isEmpty else {
      throw speechError(code: 5, message: "No speech was detected in the recording.")
    }
    return transcript
  }
}

private func speechError(code: Int, message: String) -> NSError {
  NSError(
    domain: "com.glucofinity.speech",
    code: code,
    userInfo: [NSLocalizedDescriptionKey: message]
  )
}
