import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#fff6dc",
          color: "#171008",
          fontFamily: "Arial Black, Impact, sans-serif"
        }}
      >
        {Array.from({ length: 34 }, (_, index) => (
          <div
            key={`v-${index}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: index * 36,
              width: 1,
              background: "rgba(24,16,8,0.08)"
            }}
          />
        ))}
        {Array.from({ length: 18 }, (_, index) => (
          <div
            key={`h-${index}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: index * 36,
              height: 1,
              background: "rgba(24,16,8,0.08)"
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: -120,
            top: -120,
            width: 460,
            height: 460,
            borderRadius: 999,
            background: "#f7ff2e"
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -160,
            top: 150,
            width: 420,
            height: 420,
            borderRadius: 999,
            background: "#5eeaf0"
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 48,
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            gap: 44,
            background: "#171008",
            color: "#f7ff64",
            fontSize: 18,
            letterSpacing: 0
          }}
        >
          <span>REAL DOPAMINE WAS 2020</span>
          <span>APY: TOO MUCH</span>
          <span>RUG: SELF-DEPRECATING ONLY</span>
          <span>VIBE PRICE: MEDICALLY UNSUPERVISED</span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 54,
            top: 118,
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div style={{ color: "#66625d", fontSize: 18, marginBottom: 20 }}>
            DEFINITELY AUDITED BY THE GROUP CHAT
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: 118,
              lineHeight: 0.9,
              textShadow: "8px 8px 0 #ff4aa0"
            }}
          >
            <div>Dopamine</div>
            <div>Summer</div>
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 22,
              textDecoration: "underline",
              textUnderlineOffset: 5
            }}
          >
            MADE BY VANZOOETH
          </div>
          <div
            style={{
              marginTop: 24,
              width: 650,
              padding: "24px 28px",
              background: "#fffdf5",
              border: "4px solid #171008",
              boxShadow: "8px 8px 0 #171008",
              fontFamily: "Courier New, monospace",
              fontSize: 28,
              lineHeight: 1.35
            }}
          >
            Fake liquidity. Real contracts. Zero financial advice. Maximum 2020 energy.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 72,
            top: 96,
            width: 340,
            height: 470,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "#f64998",
            border: "5px solid #171008",
            boxShadow: "10px 10px 0 #171008",
            transform: "rotate(1deg)",
            paddingTop: 34
          }}
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              style={{
                width: 98,
                height: 98,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                background: "#f7ff64",
                border: "5px solid #171008",
                boxShadow: "7px 7px 0 #171008",
                fontSize: 56,
                marginBottom: 26
              }}
            >
              🫠
            </div>
          ))}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 12,
              width: 260,
              padding: "22px",
              background: "#171008",
              color: "#f7ff64",
              border: "4px solid #fff",
              fontFamily: "Courier New, monospace",
              fontSize: 18,
              lineHeight: 1.5
            }}
          >
            <div style={{ color: "#49ff8c", fontSize: 38 }}>0 🫠</div>
            <div>PENDING DOPAMINE CLAIM, STILL NO VALUE</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
