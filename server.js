require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Upstox MCP Running");
});

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});