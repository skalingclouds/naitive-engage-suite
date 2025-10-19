"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle,
  AlertCircle,
  User,
  FileText,
  Eye 
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

export interface FormData {
  // Step 1: Consent
  tcpaConsent: boolean;
  
  // Step 2: Personal Information
  firstName: string;
  lastName: string;
  phone: string;
  employer: string;
  
  // Step 3: Review
  confirmed: boolean;
}

interface MultiStepFormProps {
  onSubmit: (data: FormData) => void;
  isSubmitting?: boolean;
}

export function MultiStepForm({ onSubmit, isSubmitting = false }: MultiStepFormProps) {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    tcpaConsent: false,
    firstName: "",
    lastName: "",
    phone: "",
    employer: "",
    confirmed: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

const updateFormData = <T extends keyof FormData>(field: T, value: FormData[T]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.tcpaConsent) {
          newErrors.tcpaConsent = "TCPA consent is required to proceed";
        }
        break;

      case 2:
        if (!formData.firstName.trim()) {
          newErrors.firstName = "First name is required";
        }
        if (!formData.lastName.trim()) {
          newErrors.lastName = "Last name is required";
        }
        if (!formData.phone.trim()) {
          newErrors.phone = "Phone number is required";
        } else if (!/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
          newErrors.phone = "Please enter a valid phone number";
        }
        if (!formData.employer.trim()) {
          newErrors.employer = "Employer name is required";
        }
        break;

      case 3:
        if (!formData.confirmed) {
          newErrors.confirmed = "Please confirm your information is accurate";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      onSubmit(formData);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length === 0) return "";
    
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else if (cleaned.length <= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else {
      return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    updateFormData("phone", formatted);
  };

  // Step 1: TCPA Consent
  const renderConsentStep = () => (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{t("consentTitle")}</h2>
          <p className="text-gray-600 dark:text-gray-400">{t("consentSubtitle")}</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="tcpa-consent"
              checked={formData.tcpaConsent}
onCheckedChange={(checked) => updateFormData("tcpaConsent", Boolean(checked))}
              disabled={isSubmitting}
            />
            <div className="space-y-2">
              <Label htmlFor="tcpa-consent" className="text-sm font-medium cursor-pointer">
                {t("iAgree")}
              </Label>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {t("tcpaConsent")}
              </p>
            </div>
          </div>
        </div>

        {errors.tcpaConsent && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.tcpaConsent}</AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );

  // Step 2: Personal Information
  const renderPersonalInfoStep = () => (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{t("personalInfoTitle")}</h2>
          <p className="text-gray-600 dark:text-gray-400">{t("personalInfoSubtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t("firstName")}</Label>
            <Input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => updateFormData("firstName", e.target.value)}
              placeholder="John"
              disabled={isSubmitting}
              className={errors.firstName ? "border-red-500" : ""}
            />
            {errors.firstName && (
              <p className="text-sm text-red-500">{errors.firstName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">{t("lastName")}</Label>
            <Input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => updateFormData("lastName", e.target.value)}
              placeholder="Doe"
              disabled={isSubmitting}
              className={errors.lastName ? "border-red-500" : ""}
            />
            {errors.lastName && (
              <p className="text-sm text-red-500">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={handlePhoneChange}
            placeholder="(555) 123-4567"
            disabled={isSubmitting}
            className={errors.phone ? "border-red-500" : ""}
          />
          {errors.phone && (
            <p className="text-sm text-red-500">{errors.phone}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="employer">{t("employer")}</Label>
          <Input
            id="employer"
            type="text"
            value={formData.employer}
            onChange={(e) => updateFormData("employer", e.target.value)}
            placeholder={t("employerPlaceholder")}
            disabled={isSubmitting}
            className={errors.employer ? "border-red-500" : ""}
          />
          {errors.employer && (
            <p className="text-sm text-red-500">{errors.employer}</p>
          )}
        </div>
      </div>
    </Card>
  );

  // Step 3: Review
  const renderReviewStep = () => (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{t("reviewTitle")}</h2>
          <p className="text-gray-600 dark:text-gray-400">{t("reviewSubtitle")}</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Name:</span>
              <p className="text-gray-900 dark:text-gray-100">
                {formData.firstName} {formData.lastName}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Phone:</span>
              <p className="text-gray-900 dark:text-gray-100">{formData.phone}</p>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-gray-600 dark:text-gray-400">Employer:</span>
              <p className="text-gray-900 dark:text-gray-100">{formData.employer}</p>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-gray-600 dark:text-gray-400">SMS Consent:</span>
              <p className="text-gray-900 dark:text-gray-100">
                {formData.tcpaConsent ? "✅ Yes, I agree to receive SMS messages" : "❌ No"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="confirm-info"
            checked={formData.confirmed}
onCheckedChange={(checked) => updateFormData("confirmed", Boolean(checked))}
            disabled={isSubmitting}
          />
          <div>
            <Label htmlFor="confirm-info" className="text-sm font-medium cursor-pointer">
              {t("confirmInfo")}
            </Label>
          </div>
        </div>

        {errors.confirmed && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.confirmed}</AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{t("step")} {currentStep} {t("of")} {totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Content */}
      <div>
        {currentStep === 1 && renderConsentStep()}
        {currentStep === 2 && renderPersonalInfoStep()}
        {currentStep === 3 && renderReviewStep()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1 || isSubmitting}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          {t("previous")}
        </Button>

        {currentStep < totalSteps ? (
          <Button
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {t("next")}
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {t("submit")}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}