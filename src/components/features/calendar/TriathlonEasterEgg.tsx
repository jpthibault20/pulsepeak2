'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ─── Realistic SVG Athletes ────────────────────────────────────────────────
// Designed as detailed silhouettes with sportswear, gear, and anatomical proportions.
// All face / move to the right. Viewbox 80×80 for more detail room.

const Swimmer = () => (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Water surface */}
        <path d="M0 52c6-4 12 0 18-4s12 0 18-4 12 0 18-4 12 0 18-4" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
        <path d="M0 58c8-3 14 2 20-2s14 2 20-2 14 2 20-2" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />

        {/* Splash particles behind */}
        <circle cx="8" cy="42" r="2" fill="#93c5fd" opacity="0.5" />
        <circle cx="4" cy="38" r="1.5" fill="#bfdbfe" opacity="0.4" />
        <circle cx="12" cy="46" r="1" fill="#93c5fd" opacity="0.3" />
        <circle cx="6" cy="48" r="1.5" fill="#60a5fa" opacity="0.25" />

        {/* Body — wetsuit torso, streamlined */}
        <path d="M18 38c6-1 16-2 28-1.5" stroke="#1e293b" strokeWidth="7" strokeLinecap="round" />
        {/* Wetsuit colour stripe */}
        <path d="M22 38c5-0.5 14-1.5 22-1" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />

        {/* Back leg — flutter kick up */}
        <path d="M18 37l-7-5" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
        <path d="M11 32l-3-1" stroke="#f8b4b4" strokeWidth="2.5" strokeLinecap="round" />
        {/* Back leg — flutter kick down */}
        <path d="M18 40l-8 6" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
        <path d="M10 46l-3 2" stroke="#f8b4b4" strokeWidth="2.5" strokeLinecap="round" />

        {/* Front arm — recovery phase (above water) */}
        <path d="M42 35l10-12 4-1" stroke="#f8b4b4" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Hand */}
        <ellipse cx="57" cy="22" rx="2.5" ry="1.2" fill="#f8b4b4" transform="rotate(-15 57 22)" />

        {/* Back arm — catch phase (under water) */}
        <path d="M28 39l-8 8-4 1" stroke="#f8b4b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />

        {/* Neck */}
        <path d="M46 36l4-3" stroke="#f8b4b4" strokeWidth="3.5" strokeLinecap="round" />

        {/* Head — turned to breathe */}
        <ellipse cx="54" cy="30" rx="6" ry="5.5" fill="#f8b4b4" />
        {/* Swim cap */}
        <path d="M49 26c2-5 8-6 11-3" fill="#ef4444" />
        <path d="M48 28c1-5 9-8 13-4l-1 2c-3-3-8-1-10 2z" fill="#ef4444" />
        {/* Goggles */}
        <ellipse cx="57" cy="29" rx="3.5" ry="2" fill="#1e3a5f" opacity="0.85" />
        <ellipse cx="57" cy="29" rx="2.2" ry="1.2" fill="#38bdf8" opacity="0.5" />
        <path d="M53 29l-3 0.5" stroke="#334155" strokeWidth="1" />
        {/* Mouth (breathing) */}
        <ellipse cx="58" cy="33" rx="1.5" ry="0.8" fill="#b45309" opacity="0.5" />

        {/* Bubbles */}
        <circle cx="60" cy="36" r="1" fill="#bfdbfe" opacity="0.4" />
        <circle cx="63" cy="34" r="0.7" fill="#bfdbfe" opacity="0.3" />
    </svg>
);

const Cyclist = () => (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* ── Wheels ── */}
        {/* Back wheel */}
        <circle cx="20" cy="54" r="14" stroke="#475569" strokeWidth="2.5" fill="none" />
        <circle cx="20" cy="54" r="12" stroke="#94a3b8" strokeWidth="0.5" fill="none" opacity="0.3" />
        <circle cx="20" cy="54" r="2.5" fill="#64748b" />
        {/* Back spokes */}
        {[0, 45, 90, 135].map(a => (
            <line key={`bs${a}`} x1="20" y1="54" x2={20 + 12 * Math.cos(a * Math.PI / 180)} y2={54 + 12 * Math.sin(a * Math.PI / 180)} stroke="#94a3b8" strokeWidth="0.6" />
        ))}
        {/* Back tire tread */}
        <circle cx="20" cy="54" r="14" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />

        {/* Front wheel */}
        <circle cx="62" cy="54" r="14" stroke="#475569" strokeWidth="2.5" fill="none" />
        <circle cx="62" cy="54" r="12" stroke="#94a3b8" strokeWidth="0.5" fill="none" opacity="0.3" />
        <circle cx="62" cy="54" r="2.5" fill="#64748b" />
        {[0, 45, 90, 135].map(a => (
            <line key={`fs${a}`} x1="62" y1="54" x2={62 + 12 * Math.cos(a * Math.PI / 180)} y2={54 + 12 * Math.sin(a * Math.PI / 180)} stroke="#94a3b8" strokeWidth="0.6" />
        ))}
        <circle cx="62" cy="54" r="14" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />

        {/* ── Frame ── */}
        {/* Main triangle */}
        <path d="M20 54l16-24 26 24" stroke="#dc2626" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
        {/* Top tube */}
        <path d="M36 30l24 0" stroke="#dc2626" strokeWidth="2.5" />
        {/* Seat tube */}
        <path d="M36 30l-4 24" stroke="#dc2626" strokeWidth="2" />
        {/* Seat stays */}
        <path d="M20 54l16-24" stroke="#dc2626" strokeWidth="1.5" opacity="0.6" />
        {/* Fork */}
        <path d="M60 30l2 24" stroke="#475569" strokeWidth="2" />

        {/* Handlebars — drop bars */}
        <path d="M60 30c3-1 5 0 6 3l-1 4" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Bar tape */}
        <path d="M64 33l-1 4" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />

        {/* Saddle */}
        <path d="M31 28c2-1 7-1 8 0" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />

        {/* Pedals & cranks */}
        <circle cx="32" cy="54" r="1.5" fill="#64748b" />
        <line x1="32" y1="54" x2="28" y2="60" stroke="#64748b" strokeWidth="1.5" />
        <line x1="32" y1="54" x2="36" y2="48" stroke="#64748b" strokeWidth="1.5" />
        <rect x="26" y="59" width="4" height="2" rx="0.5" fill="#475569" />
        <rect x="34" y="47" width="4" height="2" rx="0.5" fill="#475569" />

        {/* ── Rider ── */}
        {/* Back leg — down stroke */}
        <path d="M34 29l-4 16-2 14" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Front leg — up stroke */}
        <path d="M34 29l4 12 0 8" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Shoes */}
        <rect x="26" y="58" width="5" height="2.5" rx="1" fill="#f43f5e" />
        <rect x="36" y="47" width="5" height="2.5" rx="1" fill="#f43f5e" />

        {/* Torso — aero tuck */}
        <path d="M34 29c4-6 12-6 20-4" stroke="#0ea5e9" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        {/* Jersey detail */}
        <path d="M40 25c3-1 8-1 12 0" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

        {/* Arms on drops */}
        <path d="M50 24l12 8" stroke="#f8b4b4" strokeWidth="3" strokeLinecap="round" />
        {/* Forearm */}
        <path d="M62 32l2 4" stroke="#f8b4b4" strokeWidth="2.5" strokeLinecap="round" />

        {/* Head */}
        <ellipse cx="56" cy="18" rx="5" ry="5.5" fill="#f8b4b4" />
        {/* Aero helmet */}
        <path d="M51 14c2-4 7-5 10-3l1 3-4 5c-2 1-5 0-7-2z" fill="#1e293b" />
        <path d="M62 14l4 2-1 2" fill="#1e293b" />
        {/* Sunglasses */}
        <path d="M54 17c1-1 5-1 6 0" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
        <path d="M55 17l-2 0" stroke="#334155" strokeWidth="1" />
    </svg>
);

const Runner = () => (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Motion lines */}
        <line x1="6" y1="28" x2="16" y2="28" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
        <line x1="4" y1="36" x2="15" y2="36" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
        <line x1="8" y1="44" x2="17" y2="44" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" opacity="0.25" />

        {/* ── Back leg — push-off ── */}
        {/* Thigh */}
        <path d="M38 42l-12 12" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" />
        {/* Shin */}
        <path d="M26 54l-6 10" stroke="#f8b4b4" strokeWidth="3.5" strokeLinecap="round" />
        {/* Shoe */}
        <path d="M20 64c-1 1-1 3 1 3l6-0.5c1-0.5 1-2 0-2.5l-4-1z" fill="#10b981" />
        <path d="M21 66l5-0.5" stroke="#059669" strokeWidth="0.8" />

        {/* ── Front leg — stride ── */}
        {/* Thigh */}
        <path d="M38 42l14 8" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" />
        {/* Shin */}
        <path d="M52 50l6 8" stroke="#f8b4b4" strokeWidth="3.5" strokeLinecap="round" />
        {/* Shoe */}
        <path d="M58 58c1 0.5 2 2 1 3l-5 1c-1 0-2-1-1-2.5l3-2z" fill="#10b981" />
        <path d="M54 61l4-1" stroke="#059669" strokeWidth="0.8" />

        {/* Ground contact shadow */}
        <ellipse cx="40" cy="68" rx="18" ry="2" fill="#000" opacity="0.06" />

        {/* ── Torso ── */}
        <path d="M40 22l-2 20" stroke="#0ea5e9" strokeWidth="5.5" strokeLinecap="round" />
        {/* Singlet detail */}
        <path d="M39.5 26l-0.5 6" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        {/* Race number */}
        <rect x="36" y="30" width="7" height="5" rx="0.5" fill="white" opacity="0.7" />
        <text x="39.5" y="34" textAnchor="middle" fontSize="4" fill="#1e293b" fontWeight="bold">42</text>

        {/* ── Back arm — swinging back ── */}
        <path d="M40 26l-12 6" stroke="#f8b4b4" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 32l-3 6" stroke="#f8b4b4" strokeWidth="2.5" strokeLinecap="round" />

        {/* ── Front arm — swinging forward ── */}
        <path d="M40 26l10 6" stroke="#f8b4b4" strokeWidth="3" strokeLinecap="round" />
        <path d="M50 32l4 2" stroke="#f8b4b4" strokeWidth="2.5" strokeLinecap="round" />

        {/* ── Head ── */}
        <ellipse cx="42" cy="14" rx="6" ry="6.5" fill="#f8b4b4" />
        {/* Running cap */}
        <path d="M36 11c2-4 8-5 12-3l0 2c-3-2-8-1-10 1z" fill="#ef4444" />
        {/* Cap visor */}
        <path d="M48 10c2 0 4 1 4 2l-3 1z" fill="#dc2626" />
        {/* Sunglasses */}
        <path d="M40 13c1-0.5 4-0.5 5 0" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
        {/* Ear */}
        <ellipse cx="36" cy="14" rx="1.2" ry="1.8" fill="#e8a090" />
        {/* Mouth — determination */}
        <line x1="43" y1="17" x2="45" y2="17" stroke="#b45309" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />

        {/* Sweat drops */}
        <circle cx="34" cy="18" r="0.8" fill="#60a5fa" opacity="0.4" />
        <circle cx="32" cy="22" r="0.6" fill="#60a5fa" opacity="0.3" />
    </svg>
);

// ─── Phase config ──────────────────────────────────────────────────────────

const PHASES = [
    { Icon: Swimmer,  fraction: 0.30 },
    { Icon: Cyclist,   fraction: 0.40 },
    { Icon: Runner,    fraction: 0.30 },
];

const TOTAL_DURATION = 6500;
const ICON_SIZE = 80;
const MARGIN = 80;
const MOBILE_BREAKPOINT = 768;

// ─── Component ─────────────────────────────────────────────────────────────

export function TriathlonEasterEgg({ active, onDone }: { active: boolean; onDone: () => void }) {
    const [running, setRunning] = useState(false);
    const [pos, setPos] = useState({ x: -MARGIN, y: -MARGIN });
    const [phaseIdx, setPhaseIdx] = useState(0);
    const [scale, setScale] = useState(1);
    const [isMobile, setIsMobile] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [prevActive, setPrevActive] = useState(active);
    const rafRef = useRef(0);
    const startRef = useRef(0);
    const waypointsRef = useRef<number[]>([]);

    // Démarre quand active passe à true
    if (active && !prevActive) {
        setPrevActive(true);
        setIsMobile(typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
        setRunning(true);
    } else if (!active && prevActive) {
        setPrevActive(false);
    }

    useEffect(() => {
        if (!running) return;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const mobile = isMobile;

        // Main axis: left→right on desktop, top→bottom on mobile
        const mainLength = mobile ? h : w;
        const crossLength = mobile ? w : h;
        const totalDist = mainLength + MARGIN * 2;

        // Random waypoints along the cross-axis
        const NUM_WAYPOINTS = 6;
        const crossMin = crossLength * 0.12;
        const crossMax = crossLength * 0.78;
        waypointsRef.current = Array.from({ length: NUM_WAYPOINTS + 1 }, () =>
            crossMin + Math.random() * (crossMax - crossMin)
        );

        const boundaries = [0, 0.30, 0.70, 1.0];

        function lerpCross(t: number): number {
            const pts = waypointsRef.current;
            const segment = t * (pts.length - 1);
            const i = Math.min(Math.floor(segment), pts.length - 2);
            const frac = segment - i;
            const smooth = frac * frac * (3 - 2 * frac);
            return pts[i] + (pts[i + 1] - pts[i]) * smooth;
        }

        function tick(now: number) {
            if (!startRef.current) startRef.current = now;
            const elapsed = now - startRef.current;
            const t = Math.min(elapsed / TOTAL_DURATION, 1);

            const main = -MARGIN + totalDist * t;
            const cross = lerpCross(t);

            if (mobile) {
                setPos({ x: cross, y: main });
                // On mobile, rotate 90° so the athlete faces downward
                setRotation(90);
            } else {
                setPos({ x: main, y: cross });
                setRotation(0);
            }

            let idx = 0;
            if (t >= boundaries[2]) idx = 2;
            else if (t >= boundaries[1]) idx = 1;
            setPhaseIdx(idx);

            const distFromBoundary1 = Math.abs(t - boundaries[1]);
            const distFromBoundary2 = Math.abs(t - boundaries[2]);
            const threshold = 0.02;
            if (distFromBoundary1 < threshold || distFromBoundary2 < threshold) {
                const dist = Math.min(distFromBoundary1, distFromBoundary2);
                setScale(1 + (1 - dist / threshold) * 0.3);
            } else {
                setScale(1);
            }

            if (t < 1) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                setRunning(false);
                setScale(1);
                onDone();
            }
        }

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [running, isMobile, onDone]);

    if (!running) return null;

    const { Icon } = PHASES[phaseIdx];

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 9999,
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: pos.x - ICON_SIZE / 2,
                    top: pos.y - ICON_SIZE / 2,
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    transform: `scale(${scale}) rotate(${rotation}deg)`,
                    willChange: 'left, top, transform',
                    userSelect: 'none',
                    filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))',
                }}
            >
                <Icon />
            </div>
        </div>,
        document.body
    );
}
