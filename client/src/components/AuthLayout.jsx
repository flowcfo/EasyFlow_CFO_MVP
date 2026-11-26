import { motion } from 'framer-motion';

const SUPPORT_EMAIL = 'nick@easyflowcfo.com';

/**
 * Shared shell for Login, ForgotPassword, ResetPassword, SetPassword.
 *
 * Layout:
 *   - Glossy Cobalt band across the top, cream page below (brand look)
 *   - Centered white card, max ~420px, soft cobalt shadow
 *   - Contact line under the card
 *
 * Children render INSIDE the white card and start with the logo.
 */
export default function AuthLayout({ children, showContactLink = true }) {
  return (
    <div className="relative min-h-screen bg-cream text-navy">
      <div className="absolute inset-x-0 top-0 h-72 bg-glossy-cobalt" aria-hidden="true" />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-[420px] rounded-[18px] bg-white p-8 shadow-card sm:p-10"
        >
          {children}
        </motion.div>
        {showContactLink && (
          <p className="mt-6 text-center text-sm text-slate">
            Need an account?{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=EasyFlow%20CFO%20account%20request`}
              className="font-bold text-cobalt hover:underline"
            >
              Contact your CFO
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

export { SUPPORT_EMAIL };
