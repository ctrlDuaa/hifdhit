import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				'arabic': ['DigitalKhattV2', 'Noto Sans Arabic', 'Times New Roman', 'serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				gold: {
					DEFAULT: 'hsl(var(--gold))',
					foreground: 'hsl(var(--gold-foreground))'
				},
				mistake: {
					DEFAULT: 'hsl(var(--mistake))',
					foreground: 'hsl(var(--mistake-foreground))'
				},
				'gradient-start': 'hsl(var(--gradient-start))',
				'gradient-end': 'hsl(var(--gradient-end))',
				'progress-bg': 'hsl(var(--progress-bg))',
				'progress-bar': 'hsl(var(--progress-bar))',
				'stat-pages': 'hsl(var(--stat-pages))',
				'stat-mistakes': 'hsl(var(--stat-mistakes))',
				'surah-completed': 'hsl(var(--surah-completed))',
				'surah-progress': 'hsl(var(--surah-progress))',
				'surah-pending': 'hsl(var(--surah-pending))',
				'mistake-harakah': 'hsl(var(--mistake-harakah))',
				'mistake-missed': 'hsl(var(--mistake-missed))',
				'mistake-tajweed': 'hsl(var(--mistake-tajweed))',
				'mistake-incorrect': 'hsl(var(--mistake-incorrect))',
				'mistake-harakah-border': 'hsl(var(--mistake-harakah-border))',
				'mistake-missed-border': 'hsl(var(--mistake-missed-border))',
				'mistake-tajweed-border': 'hsl(var(--mistake-tajweed-border))',
				'mistake-incorrect-border': 'hsl(var(--mistake-incorrect-border))'
			},
			borderRadius: {
				lg: '10px',
				md: '8px',
				sm: '6px'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
