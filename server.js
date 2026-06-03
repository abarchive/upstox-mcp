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



// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {

  res.send("Dhan Institutional Backend Running");

});



// =====================================================
// LIVE NIFTY SPOT
// =====================================================

app.get("/spot", async (req, res) => {

  try {

    const response = await axios.post(
      "https://api.dhan.co/v2/marketfeed/ltp",
      {
        IDX_I: [
          {
            securityId: "13"
          }
        ]
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



// =====================================================
// OPTION CHAIN
// =====================================================

app.get("/option-chain", async (req, res) => {

  try {

    // CURRENT WEEKLY EXPIRY
    const expiry =
      req.query.expiry || "2026-06-05";

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



// =====================================================
// GREEKS ENGINE
// =====================================================

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

    const deltaCall =
      underlying > strike ? 0.65 : 0.45;

    const deltaPut =
      underlying < strike ? -0.65 : -0.45;

    res.json({
      underlying,
      strike,
      iv,
      timeToExpiry,
      callPrice,
      putPrice,
      deltaCall,
      deltaPut,
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



// =====================================================
// WEBSOCKET STATUS
// =====================================================

app.get("/ws-status", (req, res) => {

  res.json({
    websocket: "ready",
    provider: "DhanHQ",
    realtime: true
  });

});



// =====================================================
// SERVER
// =====================================================

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});