require("dotenv").config();

const express = require("express");
const axios = require("axios");
const WebSocket = require("ws");
const bs = require("black-scholes");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

/* =========================
   ROOT
========================= */

app.get("/", (req, res) => {

  res.send("Upstox Advanced Trading Backend Running");

});

/* =========================
   NIFTY SPOT
========================= */

app.get("/spot", async (req, res) => {

  try {

    const response = await axios.get(
      "https://api.upstox.com/v2/market-quote/quotes",
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`,
        },
        params: {
          instrument_key: "NSE_INDEX|Nifty 50",
        },
      }
    );

    res.json(response.data);

  } catch (err) {

    res.status(500).json(
      err.response?.data || { error: err.message }
    );

  }

});

/* =========================
   OPTION CHAIN
========================= */

app.get("/option-chain", async (req, res) => {

  try {

    const response = await axios.get(
      "https://api.upstox.com/v2/option/chain",
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`,
        },
        params: {
          instrument_key: "NSE_INDEX|Nifty 50",
          expiry_date: "2026-06-25",
        },
      }
    );

    res.json(response.data);

  } catch (err) {

    res.status(500).json(
      err.response?.data || { error: err.message }
    );

  }

});

/* =========================
   GREEKS ENGINE
========================= */

app.get("/greeks", async (req, res) => {

  try {

    const S = Number(req.query.spot || 23382.6);
    const K = Number(req.query.strike || 23400);

    const T = Number(req.query.time || 7 / 365);

    const r = Number(req.query.rate || 0.06);

    const sigma = Number(req.query.iv || 0.18);

    const callPrice = bs.blackScholes(
      S,
      K,
      T,
      r,
      sigma,
      "call"
    );

    const putPrice = bs.blackScholes(
      S,
      K,
      T,
      r,
      sigma,
      "put"
    );

    res.json({
      underlying: S,
      strike: K,
      iv: sigma,
      timeToExpiry: T,
      interestRate: r,
      callPrice,
      putPrice
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* =========================
   LIVE WEBSOCKET
========================= */

const server = app.listen(
  process.env.PORT || 3000,
  () => {

    console.log(
      `Server running on port ${process.env.PORT || 3000}`
    );

  }
);

const wss = new WebSocket.Server({
  server
});

wss.on("connection", (ws) => {

  console.log("WebSocket Client Connected");

  const interval = setInterval(async () => {

    try {

      const response = await axios.get(
        "https://api.upstox.com/v2/market-quote/quotes",
        {
          headers: {
            Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`,
          },
          params: {
            instrument_key: "NSE_INDEX|Nifty 50",
          },
        }
      );

      ws.send(JSON.stringify(response.data));

    } catch (err) {

      ws.send(
        JSON.stringify({
          error: err.message
        })
      );

    }

  }, 2000);

  ws.on("close", () => {

    clearInterval(interval);

    console.log("WebSocket Client Disconnected");

  });

});