 // Tailwind Config for "Onyx" Theme
    tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        mono: ['JetBrains Mono', 'monospace'],
                    },
                    colors: {
                        onyx: {
                            50: '#f9fafb',
                            100: '#f3f4f6',
                            800: '#1f2937',
                            900: '#0f172a', /* The "Onyx" Black */
                            950: '#020617',
                        },
                        accent: '#2563EB', // Electric Blue
                    }
                }
            }
        }