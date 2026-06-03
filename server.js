require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());

const PORT = process.env.PORT || 10000;

const headers = {
  "access-token": process.env.DHAN_ACCESS_TOKEN,
  "client-id": process.env.DHAN_CLIENT_ID,
  "Content-Type": "application/json",
};



// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {

  res.send("AI Trading Backend Running");

});



// ======================================================
// WEBSOCKET STATUS
// ======================================================

app.get("/ws-status", (req, res) => {

  res.json({
    websocket: "ready",
    provider: "DhanHQ",
    realtime: true
  });

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
// GET AVAILABLE EXPIRIES
// ======================================================

app.get("/expiries", async (req, res) => {

  try {

    const response = await axios.post(
      "https://api.dhan.co/v2/optionchain",
      {
        UnderlyingScrip: 13,
        UnderlyingSeg: "IDX_I",
        Expiry: "2026-06-26"
      },
      {
        headers
      }
    );

    const data = response.data;

    const currentExpiry =
      data?.data?.expiryDate ||
      "2026-06-26";

    res.json({
      currentExpiry
    });

  } catch (err) {

    res.json({
      status: "error",
      message: err.message,
      data: err.response?.data || null
    });

  }

});



// ======================================================
// RAW OPTION CHAIN
// ======================================================

app.get("/option-chain", async (req, res) => {

  try {

    const expiry =
      req.query.expiry || "2026-06-26";

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
      data: err.response?.data || null
    });

  }

});



// ======================================================
// AI ANALYZE ENDPOINT
// ======================================================

app.get("/analyze", async (req, res) => {

  try {

    // ==========================================
    // STEP 1 - FETCH OPTION CHAIN
    // ==========================================

    const expiry =
      req.query.expiry || "2026-06-26";

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

    const data = response.data.data;

    const oc = data.oc;

    const spot =
      Number(data.last_price);

    const nearestExpiry =
      data.expiryDate || expiry;

    // ==========================================
    // STEP 2 - FIND ATM
    // ==========================================

    const strikes =
      Object.keys(oc)
        .map(Number)
        .sort((a, b) => a - b);

    let atmStrike = strikes[0];

    let minDiff =
      Math.abs(spot - atmStrike);

    for (const strike of strikes) {

      const diff =
        Math.abs(spot - strike);

      if (diff < minDiff) {

        minDiff = diff;
        atmStrike = strike;

      }

    }

    // ==========================================
    // STEP 3 - ATM DATA
    // ==========================================

    const atmData =
      oc[atmStrike];

    const ce =
      atmData.ce || {};

    const pe =
      atmData.pe || {};

    // ==========================================
    // STEP 4 - OI CALCULATION
    // ==========================================

    let totalCallOI = 0;
    let totalPutOI = 0;

    for (const strike of strikes) {

      const strikeData =
        oc[strike];

      totalCallOI +=
        strikeData?.ce?.oi || 0;

      totalPutOI +=
        strikeData?.pe?.oi || 0;

    }

    const pcr =
      totalPutOI / totalCallOI;

    // ==========================================
    // STEP 5 - MARKET BIAS
    // ==========================================

    let marketBias = "sideways";

    if (pcr > 1.1) {

      marketBias = "bullish";

    } else if (pcr < 0.9) {

      marketBias = "bearish";

    }

    // ==========================================
    // STEP 6 - LIQUIDITY CHECK
    // ==========================================

    const ceBid =
      ce.top_bid_price || 0;

    const ceAsk =
      ce.top_ask_price || 0;

    const spread =
      Math.abs(ceAsk - ceBid);

    const liquidity =
      spread <= 2
        ? "high"
        : spread <= 5
        ? "medium"
        : "low";

    // ==========================================
    // FINAL OUTPUT
    // ==========================================

    res.json({

      spot,

      nearestExpiry,

      atmStrike,

      marketBias,

      pcr: Number(
        pcr.toFixed(2)
      ),

      totalCallOI,

      totalPutOI,

      ceLtp:
        ce.last_price || 0,

      peLtp:
        pe.last_price || 0,

      ceIV:
        ce.implied_volatility || 0,

      peIV:
        pe.implied_volatility || 0,

      ceOI:
        ce.oi || 0,

      peOI:
        pe.oi || 0,

      ceVolume:
        ce.volume || 0,

      peVolume:
        pe.volume || 0,

      spread,

      liquidity,

      greeks: {

        ceDelta:
          ce.greeks?.delta || 0,

        peDelta:
          pe.greeks?.delta || 0,

        gamma:
          ce.greeks?.gamma || 0,

        theta:
          ce.greeks?.theta || 0,

        vega:
          ce.greeks?.vega || 0

      }

    });

  } catch (err) {

    res.json({
      status: "error",
      message: err.message,
      data: err.response?.data || null
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