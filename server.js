require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bs = require("black-scholes");

const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 10000;





// ===============================
// ROOT
// ===============================

app.get("/", (req, res) => {

  res.send("Upstox Advanced Trading Backend Running");

});





// ===============================
// LIVE NIFTY SPOT
// ===============================

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

    res.status(500).json({
      status: "error",
      message: err.message,
      data: err.response?.data || null,
    });

  }

});





// ===============================
// GET AVAILABLE EXPIRIES
// ===============================

app.get("/expiries", async (req, res) => {

  try {

    const response = await axios.get(
      "https://api.upstox.com/v2/option/contract",
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`,
        },
        params: {
          instrument_key: "NSE_INDEX|Nifty 50",
        },
      }
    );

    const contracts = response.data.data || [];

    const expiries = [
      ...new Set(
        contracts.map((x) => x.expiry)
      ),
    ];

    expiries.sort();

    res.json({
      status: "success",
      expiries,
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message,
      data: err.response?.data || null,
    });

  }

});





// ===============================
// OPTION CHAIN
// ===============================

app.get("/option-chain", async (req, res) => {

  try {

    let expiry = req.query.expiry;

    // AUTO FETCH NEAREST EXPIRY
    if (!expiry) {

      const contractResponse = await axios.get(
        "https://api.upstox.com/v2/option/contract",
        {
          headers: {
            Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`,
          },
          params: {
            instrument_key: "NSE_INDEX|Nifty 50",
          },
        }
      );

      const contracts = contractResponse.data.data || [];

      const expiries = [
        ...new Set(
          contracts.map((x) => x.expiry)
        ),
      ];

      expiries.sort();

      expiry = expiries[0];

    }

    const response = await axios.get(
      "https://api.upstox.com/v2/option/chain",
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`,
        },
        params: {
          instrument_key: "NSE_INDEX|Nifty 50",
          expiry_date: expiry,
        },
      }
    );

    res.json({
      selected_expiry: expiry,
      ...response.data,
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message,
      data: err.response?.data || null,
    });

  }

});





// ===============================
// GREEKS ENGINE
// ===============================

app.get("/greeks", async (req, res) => {

  try {

    const spot = 23382.6;

    const strike = 23400;

    const iv = 0.18;

    const timeToExpiry = 7 / 365;

    const interestRate = 0.06;

    const callPrice = bs.blackScholes(
      spot,
      strike,
      timeToExpiry,
      iv,
      interestRate,
      "call"
    );

    const putPrice = bs.blackScholes(
      spot,
      strike,
      timeToExpiry,
      iv,
      interestRate,
      "put"
    );

    res.json({
      underlying: spot,
      strike,
      iv,
      timeToExpiry,
      interestRate,
      callPrice,
      putPrice,
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message,
    });

  }

});





// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

  console.log(`Server running on port ${PORT}`);

});