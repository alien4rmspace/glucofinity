import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | GlucoFinity",
  description:
    "Learn how the GlucoFinity mobile app and website handle health permissions, local data, voice entry, and model downloads.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacy"
      title="Privacy Policy"
      intro="GlucoFinity is designed around local processing, limited permissions, and user control. This policy explains what the mobile app and website access and how that information is handled."
      updated="August 20, 2026"
    >
      <section>
        <h2>Summary</h2>
        <ul>
          <li>GlucoFinity does not require an account.</li>
          <li>We do not operate a backend that receives your health records or app logs.</li>
          <li>GlucoFinity does not sell personal information, show advertising, or use health information for advertising or tracking.</li>
          <li>Apple Health, microphone, speech, camera, and photo access are optional and controlled by your device permissions.</li>
          <li>You can delete individual logs or reset locally stored app data from Settings.</li>
        </ul>
      </section>

      <section>
        <h2>Information the mobile app can access</h2>
        <h3>Apple Health and Health Connect</h3>
        <p>
          On iPhone, GlucoFinity can request read-only access to blood glucose, step count,
          active energy, and workout records you choose to share through Apple Health. On
          supported Android devices, the app can request read-only access to blood glucose
          records through Health Connect. The app does not add, alter, or delete records in
          either health store.
        </p>
        <p>
          Health permissions are optional. You can deny individual permissions or change
          access later in Apple Health, iOS Settings, or Health Connect. Available readings
          depend on records already written by another app or device.
        </p>

        <h3>Information you enter</h3>
        <p>
          You may enter meals, reviewed nutrition estimates, meal photos, medication logs,
          feeling check-ins, notes, and display preferences. These entries are stored in the
          app&apos;s local storage on your device so that you can review them later.
        </p>

        <h3>Voice, speech, camera, and photos</h3>
        <p>
          If you choose voice meal entry on a supported iPhone, microphone audio is provided
          to Apple&apos;s on-device speech recognizer. GlucoFinity requires on-device recognition
          and does not send the recording or transcript to a developer-operated transcription
          server. The app uses the resulting transcript with a locally running language model
          to create an editable meal draft. Audio is not retained as a saved app log.
        </p>
        <p>
          Camera and photo-library access are used only when you choose to attach a meal image.
          GlucoFinity does not upload the image to a developer-operated server. Your device and
          photo-library settings continue to govern the original image.
        </p>
      </section>

      <section>
        <h2>How information is used</h2>
        <p>Information available to the app is used to provide features you request, including:</p>
        <ul>
          <li>displaying permitted glucose and fitness records;</li>
          <li>organizing meals, medication logs, and feeling check-ins;</li>
          <li>calculating deterministic summaries and observational associations;</li>
          <li>creating nutrition estimates for your review; and</li>
          <li>remembering local app settings.</li>
        </ul>
        <p>
          GlucoFinity does not use health information for advertising, marketing, eligibility
          decisions, or unrelated data mining. The app does not diagnose, prescribe treatment,
          or recommend medication or insulin changes.
        </p>
      </section>

      <section>
        <h2>Local processing, storage, and retention</h2>
        <p>
          Health-store records are queried from the selected device health service when needed.
          User-created app entries and preferences remain in local app storage until you delete
          them, reset local app data, or uninstall the app. GlucoFinity does not intentionally
          synchronize this app content to a developer-operated cloud service. On iOS, the local
          app storage used for these entries is excluded from device backup by default.
        </p>
        <p>
          Downloaded speech assets, language-model files, and nutrition databases contain no
          personal health information. They may remain in app-managed or system-managed storage
          until the operating system clears them or the app is uninstalled.
        </p>
      </section>

      <section>
        <h2>Network requests and third-party services</h2>
        <p>
          The mobile app downloads the LFM2.5 model, tokenizer files, and related runtime assets
          from the Software Mansion React Native ExecuTorch repository hosted by Hugging Face.
          These download requests can expose ordinary network information, such as an IP address,
          to the hosting provider. The requests do not include your HealthKit records, meal
          transcript, medication logs, or feeling check-ins.
        </p>
        <p>
          Apple provides HealthKit, Apple Speech, and related system services under Apple&apos;s
          privacy terms. Google provides Health Connect on supported Android devices. USDA
          FoodData Central supplies the bundled nutrition reference; nutrition lookup does not
          transmit your meal entry to USDA.
        </p>
        <p>
          The public website is hosted through GitHub Pages. Its interactive demo uses fictional
          data and session-only browser state. When you activate browser voice features, the
          browser may download model files from Hugging Face; audio and transcripts remain in the
          browser, while the model host can receive ordinary download-request metadata. Hosting
          and model providers may process basic network logs under their own privacy policies.
        </p>
      </section>

      <section>
        <h2>Sharing and disclosure</h2>
        <p>
          We do not sell or rent personal information. Because GlucoFinity has no user account or
          developer-operated health-data backend, we do not have a server-side copy of your app
          logs to share. Information may still be disclosed when required by applicable law, but
          only to the extent information is actually under the developer&apos;s control.
        </p>
      </section>

      <section>
        <h2>Your choices and deletion</h2>
        <ul>
          <li>Change Apple Health or Health Connect access in your device settings.</li>
          <li>Delete individual meals, medication logs, and feeling check-ins in the app.</li>
          <li>Use <strong>Settings → Reset local app data</strong> to clear locally stored entries and preferences.</li>
          <li>Uninstall GlucoFinity to remove its app container and downloaded resources.</li>
        </ul>
        <p>
          Resetting GlucoFinity does not delete source records from Apple Health or Health Connect
          and does not change the permissions managed by those services.
        </p>
      </section>

      <section>
        <h2>Children&apos;s privacy</h2>
        <p>
          GlucoFinity is not directed to children under 13, and we do not knowingly collect
          personal information from children through a developer-operated service.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          This policy may be updated when app functionality or data handling changes. The date at
          the top of this page identifies the current version.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          GlucoFinity is developed by Damian Saelee in collaboration with Mark Betts and Chloe
          Wong as an educational university project. For privacy questions or app support, visit
          the <Link href="/support">GlucoFinity Support page</Link>.
          Do not include personal health information in a public support request.
        </p>
      </section>
    </LegalPageShell>
  );
}
