import React from 'react';
import { FileInput, Cog, Download } from 'lucide-react';
import { ProcessStatus } from '../types';

interface PipelineProps {
  status: ProcessStatus;
}

export const Pipeline: React.FC<PipelineProps> = ({ status }) => {
  const isProcessing = status === ProcessStatus.PROCESSING;
  const isCompleted = status === ProcessStatus.COMPLETED;

  const steps = [
    { label: 'INPUT', icon: FileInput, active: true, done: isProcessing || isCompleted },
    { label: 'PROCESS', icon: Cog, active: isProcessing || isCompleted, done: isCompleted, animate: isProcessing },
    { label: 'OUTPUT', icon: Download, active: isCompleted, done: isCompleted },
  ];

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between max-w-xl mx-auto relative px-4">
        {/* Progress Bar Background */}
        <div className="absolute top-8 left-0 w-full h-3 bg-white border-2 border-black -z-10 rounded-full">
          <div 
            className="h-full bg-primary border-r-2 border-black transition-all duration-700 ease-in-out rounded-l-full"
            style={{ width: isCompleted ? '100%' : isProcessing ? '50%' : '0%' }}
          ></div>
        </div>

        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center gap-3">
            <div 
              className={`
                w-16 h-16 rounded-xl flex items-center justify-center z-10 transition-all duration-300 border-2 border-black
                ${step.active 
                  ? 'bg-primary shadow-neo' 
                  : 'bg-white shadow-neo-sm'
                }
              `}
            >
              <step.icon className={`w-8 h-8 text-black ${step.animate ? 'animate-spin' : ''}`} />
            </div>
            <div className={`px-2 py-1 border-2 border-black bg-white shadow-neo-sm rounded text-xs font-black transition-colors ${step.active ? 'text-black' : 'text-gray-400'}`}>
              {step.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};