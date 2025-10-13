"use client";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Your privacy matters. This page explains what information we collect, how we use it, and your choices.
      </p>
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <p>
          We collect the minimum information needed to analyze your pay stub and contact you if you request follow‑up.
          Uploaded files are handled securely. For the MVP, certain steps are simulated and no production storage occurs
          beyond what is necessary for processing.
        </p>
        <p>
          We do not sell your personal information. For questions or requests, please contact support@wageviolation.ai.
        </p>
      </div>
    </div>
  );
}