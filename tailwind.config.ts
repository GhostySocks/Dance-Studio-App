import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        cta: {
          DEFAULT: "hsl(var(--cta))",
          foreground: "hsl(var(--cta-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Domain colors
        domain: {
          people: "hsl(var(--domain-people))",
          "people-foreground": "hsl(var(--domain-people-foreground))",
          "people-icon": "hsl(var(--domain-people-icon))",
          classes: "hsl(var(--domain-classes))",
          "classes-foreground": "hsl(var(--domain-classes-foreground))",
          "classes-icon": "hsl(var(--domain-classes-icon))",
          money: "hsl(var(--domain-money))",
          "money-foreground": "hsl(var(--domain-money-foreground))",
          "money-icon": "hsl(var(--domain-money-icon))",
          schedule: "hsl(var(--domain-schedule))",
          "schedule-foreground": "hsl(var(--domain-schedule-foreground))",
          "schedule-icon": "hsl(var(--domain-schedule-icon))",
          alert: "hsl(var(--domain-alert))",
          "alert-foreground": "hsl(var(--domain-alert-foreground))",
          "alert-icon": "hsl(var(--domain-alert-icon))",
        },
      },
      borderRadius: {
        xl: "var(--radius)",
        lg: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 6px)",
        sm: "calc(var(--radius) - 8px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
