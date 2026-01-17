import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Space Grotesk"', 'sans-serif'],
            },
            colors: {
                primary: {
                    DEFAULT: '#3B82F6',
                    hover: '#2563EB',
                    light: '#60A5FA',
                },
                secondary: '#EEEEEE',
                accent: '#FFDEE2',
                surface: '#FFFFFF',
                border: '#000000',
                background: '#FFF0F3',
            },
            boxShadow: {
                'neo': '4px 4px 0px 0px rgba(0,0,0,1)',
                'neo-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
                'neo-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
            }
        },
    },
    plugins: [],
};

export default config;
