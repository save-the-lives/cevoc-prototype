import { useEffect, useRef, useState } from "react";
import "./SampleNoticePicker.css";

const SAMPLES = [
  { number: "4012345678", type: "Mobile speed camera", offence: "Exceed speed 10–20 km/h", location: "Parramatta Rd, Granville", media: "video" },
  { number: "4023456789", type: "Red light camera", offence: "Proceed through red light", location: "Pennant Hills Rd, Carlingford", media: "photo" },
  { number: "4034567890", type: "Mobile phone detection", offence: "Use mobile phone while driving", location: "M4 Motorway, Homebush", media: "photo" },
  { number: "4045678901", type: "Average speed (heavy vehicle)", offence: "Exceed average speed", location: "Hume Hwy, Goulburn", media: "photo" },
  { number: "4056789012", type: "Seatbelt camera", offence: "Passenger not wearing seatbelt", location: "Pacific Hwy, Gordon", media: "photo" },
];

export default function SampleNoticePicker({ onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="snp" ref={ref}>
      <button type="button" className="snp-trigger" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="snp-tag">TEST</span> Use a sample notice
      </button>

      {open && (
        <div className="snp-pop" role="listbox" aria-label="Prototype sample notices">
          <div className="snp-strip">PROTOTYPE ONLY · SAMPLE DATA · NOT A REAL NOTICE</div>
          <ul>
            {SAMPLES.map((s) => (
              <li key={s.number}>
                <button
                  type="button"
                  role="option"
                  className="snp-item"
                  onClick={() => { onSelect(s.number, s); setOpen(false); }}
                >
                  <span className="snp-num">{s.number}</span>
                  <span className="snp-meta">
                    <strong>{s.type}</strong> · {s.offence}<br />{s.location}
                  </span>
                  <span className="snp-media">{s.media === "video" ? "▶ Video" : "📷 Photo"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
