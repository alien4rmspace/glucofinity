export function hasUnprocessedTranscriptChanges(
  transcript: string,
  processedTranscript: string
): boolean {
  return transcript.trim() !== processedTranscript.trim();
}
