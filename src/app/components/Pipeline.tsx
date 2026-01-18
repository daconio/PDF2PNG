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
        { label: 'Input', icon: FileInput, active: true },
        { label: 'Engine', icon: Cog, active: isProcessing || isCompleted, animate: isProcessing },
        { label: 'Result', icon: Download, active: isCompleted },
    ];

    return (
        <div className="w-full py-8">
            <div className="flex items-center justify-between max-w-2xl mx-auto relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-300 -z-10 transform -translate-y-1/2"></div>
                <div
                    className="absolute top-1/2 left-0 h-1 bg-black -z-10 transform -translate-y-1/2 transition-all duration-700 ease-in-out"
                    style={{ width: isCompleted ? '100%' : isProcessing ? '50%' : '0%' }}
                ></div>

                {steps.map((step, idx) => (
                    <div key={idx} className="flex flex-col items-center bg-transparent">
                        <div
                            className={`
                w-16 h-16 rounded-full border-2 border-black flex items-center justify-center z-10 transition-all duration-300
                ${step.active ? 'bg-primary text-white shadow-neo' : 'bg-white text-gray-400'}
              `}
                        >
                            <step.icon
                                className={`w-8 h-8 ${step.animate ? 'animate-spin' : ''}`}
                            />
                        </div>
                        <span className={`mt-2 font-bold bg-white px-2 border border-black ${step.active ? 'text-black' : 'text-gray-400'}`}>
                            {step.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
