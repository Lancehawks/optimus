import Image from 'next/image';

// Original O + green dot, extracted losslessly from the project's favicon.
// Rendered as the bare transparent PNG; the inline reset neutralises legacy
// badge styles (gradients, shadows) that callers' classNames still carry.
export default function OptimusLogo({ size = 32, className = '' }) {
  return (
    <span className={className} aria-hidden="true" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, flexShrink: 0, padding: 0,
      boxSizing: 'border-box', borderRadius: 0,
      background: 'transparent', border: 'none', boxShadow: 'none',
    }}>
      <Image src="/optimus-logo.png" alt="" width={48} height={48} unoptimized
        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </span>
  );
}
