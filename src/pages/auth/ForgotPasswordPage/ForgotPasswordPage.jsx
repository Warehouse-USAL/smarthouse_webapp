import { useState } from "react";

import AuthLayout from "../../../components/auth/AuthLayout/AuthLayout";

import Step1SendLink from "./steps/Step1SendLink";
import Step2LinkSent from "./steps/Step2LinkSent";
import Step3ResetPassword from "./steps/Step3ResetPassword";
import Step4Success from "./steps/Step4Success";

import "./ForgotPasswordPage.css";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);

  const nextStep = () => {
    setStep((prev) => prev + 1);
  };

  const steps = {
    1: Step1SendLink(nextStep),
    2: Step2LinkSent(nextStep),
    3: Step3ResetPassword(nextStep),
    4: Step4Success(),
  };

  const currentStep = steps[step];

  return (
    <div className="container_center_login">
      <AuthLayout
        leftContent={currentStep.leftContent}
        rightContent={currentStep.rightContent}
      />
    </div>
  );
}