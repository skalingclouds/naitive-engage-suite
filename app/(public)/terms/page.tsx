"use client";

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Please read these terms carefully. By using this service, you agree to the terms below.
      </p>
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <p>
          This service provides informational analysis only and does not constitute legal advice. Use of the platform
          does not create an attorney‑client relationship. For legal advice, consult a licensed attorney.
        </p>
        <p>
          We reserve the right to update these terms. Continued use of the service after updates constitutes acceptance
          of the revised terms.
        </p>
      </div>
    </div>
  );
}