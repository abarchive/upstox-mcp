```javascript
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());

const PORT = process.env.PORT || 10000;



// ======================================================
// DHAN HEADERS
// ======================================================

const headers = {
  "access-token": process.env.DHAN_ACCESS_TOKEN,
  "client-id": process.env.DHAN_CLIENT_ID,
  "Content-Type": "application/json",
};



// ======================================================
// HELPERS
// ======================================================

function roundToStrike(price, step = 50) {
  return Math.round(price / step) * step;
}



// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {

  res.send("AI Institutional Trading Backend Running");

});



// ======================================================
// WS STATUS
// ======================================================

app.get("/ws-status", (req, res) => {

  res.json({
    websocket: "ready",
    provider: "DhanHQ",
    realtime: true,
    serverTime: new Date().toISOString()
  });

});



// ======================================================
// LIVE SPOT
// ======================================================

app.get("/spot", async (req, res) => {

  try {

    const response = await axios.post(
      "https://api.dhan.co/v2/marketfeed/ltp",
      {
        NSE_IDX: ["13"]
      },
      {
        headers
      }
    );

    const data = response.data;

    const nifty =
      data?.data?.NSE_IDX?.["13"] || {};

    res.json({

      provider: "DhanHQ",

      instrument: "NIFTY 50",

      realtime: true,

      spot:
        nifty.last_price || 0,

      raw: nifty

    });

  } catch (err) {

    res.json({

      status: "error",

      message: err.message,

      data:
        err.response?.data || null

    });

  }

});



// ======================================================
// GREEKS ENGINE
// ======================================================

app.get("/greeks", async (req, res) => {

  try {

    const underlying =
      Number(req.query.underlying || 23400);

    const strike =
      Number(req.query.strike || 23400);

    const iv =
      Number(req.query.iv || 18) / 100;

    const timeToExpiry =
      Number(req.query.t || 7) / 365;

    const intrinsicCall =
      Math.max(0, underlying - strike);

    const intrinsicPut =
      Math.max(0, strike - underlying);

    const extrinsic =
      underlying *
      iv *
      Math.sqrt(timeToExpiry) *
      0.4;

    const callPrice =
      intrinsicCall + extrinsic;

    const putPrice =
      intrinsicPut + extrinsic;

    res.json({

      underlying,
      strike,
      iv,

      callPrice,
      putPrice,

      deltaCall: 0.52,
      deltaPut: -0.48,

      gamma: 0.012,
      theta: -8.4,
      vega: 11.2

    });

  } catch (err) {

    res.json({
      status: "error",
      message: err.message
    });

  }

});



// ======================================================
// RAW OPTION CHAIN
// ======================================================

app.get("/option-chain", async (req, res) => {

  try {

    const expiry =
      req.query.expiry || "2026-06-09";

    const response = await axios.post(
      "https://api.dhan.co/v2/optionchain",
      {
        UnderlyingScrip: 13,
        UnderlyingSeg: "IDX_I",
        Expiry: expiry
      },
      {
        headers
      }
    );

    res.json(response.data);

  } catch (err) {

    res.json({

      status: "error",

      message: err.message,

      data:
        err.response?.data || null

    });

  }

});



// ======================================================
// MASTER AI ENDPOINT
// ======================================================

app.get("/market-data", async (req, res) => {

  try {

    // ==================================================
    // STEP 1 - FETCH SPOT
    // ==================================================

    let spot = 0;

    try {

      const spotResponse = await axios.post(
        "https://api.dhan.co/v2/marketfeed/ltp",
        {
          NSE_IDX: ["13"]
        },
        {
          headers
        }
      );

      spot =
        Number(
          spotResponse.data?.data?.NSE_IDX?.["13"]?.last_price || 0
        );

    } catch (e) {

      console.log("Spot fetch failed");

    }

    // ==================================================
    // STEP 2 - TRY EXPIRIES
    // ==================================================

    const expiriesToTry = [

      "2026-06-09",
      "2026-06-16",
      "2026-06-23",
      "2026-06-30",
      "2026-07-07",
      "2026-07-28"

    ];

    let finalData = null;
    let selectedExpiry = null;

    for (const expiry of expiriesToTry) {

      try {

        const response = await axios.post(
          "https://api.dhan.co/v2/optionchain",
          {
            UnderlyingScrip: 13,
            UnderlyingSeg: "IDX_I",
            Expiry: expiry
          },
          {
            headers
          }
        );

        if (
          response.data &&
          response.data.data &&
          response.data.data.oc
        ) {

          finalData = response.data.data;

          selectedExpiry = expiry;

          break;

        }

      } catch (e) {

        console.log(`Expiry failed: ${expiry}`);

      }

    }

    // ==================================================
    // NO DATA
    // ==================================================

    if (!finalData) {

      return res.json({

        status: "error",

        message: "No valid expiry found"

      });

    }

    // ==================================================
    // OPTION CHAIN
    // ==================================================

    const oc = finalData.oc || {};

    // ==================================================
    // FALLBACK SPOT
    // ==================================================

    if (!spot || spot === 0) {

      spot =
        Number(finalData.last_price || 0);

    }

    // ==================================================
    // STRIKES
    // ==================================================

    const strikes =
      Object.keys(oc)
        .map(Number)
        .sort((a, b) => a - b);

    // ==================================================
    // ATM
    // ==================================================

    const atmStrike =
      roundToStrike(spot);

    const atmKey =
      Number(atmStrike)
        .toFixed(6);

    let atmData =
      oc[atmKey];

    // ==================================================
    // FALLBACK ATM
    // ==================================================

    if (!atmData) {

      const nearest =
        strikes.reduce((prev, curr) => {

          return (
            Math.abs(curr - spot) <
            Math.abs(prev - spot)
              ? curr
              : prev
          );

        });

      const nearestKey =
        Number(nearest)
          .toFixed(6);

      atmData =
        oc[nearestKey];

    }

    const ce =
      atmData?.ce || {};

    const pe =
      atmData?.pe || {};

    // ==================================================
    // OI + PCR
    // ==================================================

    let totalCallOI = 0;
    let totalPutOI = 0;

    for (const strike of strikes) {

      const strikeKey =
        Number(strike)
          .toFixed(6);

      const strikeData =
        oc[strikeKey];

      totalCallOI +=
        Number(
          strikeData?.ce?.oi || 0
        );

      totalPutOI +=
        Number(
          strikeData?.pe?.oi || 0
        );

    }

    const pcr =
      totalCallOI > 0
        ? totalPutOI / totalCallOI
        : 0;

    // ==================================================
    // MARKET BIAS
    // ==================================================

    let marketBias = "sideways";

    if (pcr > 1.1) {

      marketBias = "bullish";

    } else if (pcr < 0.9) {

      marketBias = "bearish";

    }

    // ==================================================
    // LIQUIDITY
    // ==================================================

    const ceBid =
      Number(
        ce.top_bid_price || 0
      );

    const ceAsk =
      Number(
        ce.top_ask_price || 0
      );

    const spread =
      Math.abs(ceAsk - ceBid);

    const liquidity =
      spread <= 2
        ? "high"
        : spread <= 5
        ? "medium"
        : "low";

    // ==================================================
    // FINAL OUTPUT
    // ==================================================

    res.json({

      provider: "DhanHQ",

      realtime: true,

      timestamp:
        new Date().toISOString(),

      nearestExpiry:
        selectedExpiry,

      spot,

      atmStrike,

      marketBias,

      pcr:
        Number(
          pcr.toFixed(2)
        ),

      liquidity,

      spread,

      totals: {

        totalCallOI,

        totalPutOI

      },

      atm: {

        ce: {

          ltp:
            ce.last_price || 0,

          bid:
            ce.top_bid_price || 0,

          ask:
            ce.top_ask_price || 0,

          oi:
            ce.oi || 0,

          volume:
            ce.volume || 0,

          iv:
            ce.implied_volatility || 0,

          greeks:
            ce.greeks || {}

        },

        pe: {

          ltp:
            pe.last_price || 0,

          bid:
            pe.top_bid_price || 0,

          ask:
            pe.top_ask_price || 0,

          oi:
            pe.oi || 0,

          volume:
            pe.volume || 0,

          iv:
            pe.implied_volatility || 0,

          greeks:
            pe.greeks || {}

        }

      },

      strikes,

      fullOptionChain: oc

    });

  } catch (err) {

    res.json({

      status: "error",

      message: err.message,

      data:
        err.response?.data || null

    });

  }

});



// ======================================================
// SERVER
// ======================================================

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});
```
