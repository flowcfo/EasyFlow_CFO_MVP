import { motion } from 'framer-motion';

const SUPPORT_EMAIL = 'nick@easyflowcfo.com';

/**
 * Shared shell for Login, ForgotPassword, ResetPassword, SetPassword.
 *
 * Layout:
 *   - Full-screen navy background
 *   - Top-right contact link
 *   - Centered white card, max ~400px, soft shadow
 *
 * Children render INSIDE the white card. Card text inherits navy on white.
 */
export default function AuthLayout({ children, showContactLink = true }) {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4 py-8 relative">
      {showContactLink && (
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=EasyFlow%20CFO%20account%20request`}
          className="absolute top-6 right-6 font-mulish text-xs text-stone-light hover:text-white transition"
        >
          Need an account? Contact your CFO
        </a>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl p-10 text-navy"
      >
        {children}
      </motion.div>
    </div>
  );
}

export { SUPPORT_EMAIL };
