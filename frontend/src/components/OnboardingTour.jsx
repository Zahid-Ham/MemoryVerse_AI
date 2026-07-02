import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, X, Brain, UploadCloud, Network, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const STEPS = [
  {
    title: "Welcome to MemoryVerse AI",
    description: "Your second brain is active. We automatically extract and connect your certifications, project reports, resumes, and internship letter files.",
    icon: Brain,
    color: "text-violet-500 bg-violet-500/10",
    actionText: "Let's Explore",
    targetPath: "/dashboard"
  },
  {
    title: "Instant Demo Ingestion",
    description: "Don't want to browse folders? Go to 'Upload Files' and click 'Import Demo Dataset' to populate sample documents instantly.",
    icon: UploadCloud,
    color: "text-sky-500 bg-sky-500/10",
    actionText: "Go to Ingestion",
    targetPath: "/upload"
  },
  {
    title: "Connected Relationships",
    description: "The AI parses names, locations, and skills. Check the 'Relationships' graph to see document layers mapped visually.",
    icon: Network,
    color: "text-emerald-500 bg-emerald-500/10",
    actionText: "View Node Mapping",
    targetPath: "/relationships"
  },
  {
    title: "Ask Your Second Brain",
    description: "Query your digital history in the 'Chat Assistant'. Responses are formatted in Markdown, complete with matching sources and similarity percentages.",
    icon: MessageSquare,
    color: "text-amber-500 bg-amber-500/10",
    actionText: "Open Chat Assistant",
    targetPath: "/chat"
  }
];

export default function OnboardingTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const isCompleted = localStorage.getItem('mv_onboarding_completed');
    if (!isCompleted) {
      setIsOpen(true);
    }
  }, []);

  const handleNext = () => {
    const nextStep = currentStep + 1;
    if (nextStep < STEPS.length) {
      setCurrentStep(nextStep);
      navigate(STEPS[nextStep].targetPath);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem('mv_onboarding_completed', 'true');
    setIsOpen(false);
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const Icon = step.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl overflow-hidden"
        >
          {/* Header Accent Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-violet-500 to-emerald-500" />

          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-1 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 md:p-8 space-y-6">
            {/* Step count / Title */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Demo Step {currentStep + 1} of {STEPS.length}
              </span>
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            </div>

            {/* Icon & Description */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${step.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                {step.description}
              </p>
            </div>

            {/* Step Indicators */}
            <div className="flex gap-1.5">
              {STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'w-6 bg-primary' : 'w-2 bg-muted'
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSkip}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip Tour
              </button>
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary-hover text-xs font-semibold rounded-lg shadow-sm shadow-primary/10 hover:shadow-md transition-all"
              >
                {step.actionText}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
