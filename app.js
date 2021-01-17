const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const AWS = require("aws-sdk");
const env = process.env.NODE_ENV || "development";
if (env === "development") {
  const profileCreds = require("./credentials.json");
  const credentials = new AWS.SharedIniFileCredentials({
    profile: profileCreds["profile"],
  });
  AWS.config.credentials = credentials;
}

// S3 service
const s3 = new AWS.S3();

app.get("/", (req, res) => {
  res.send(
    JSON.stringify({ port: port, message: "hello from my backend server!" })
  );
});

app.get("/buckets", async (req, res) => {
  s3.listBuckets(function (err, data) {
    if (err) {
      res.send(JSON.stringify(err));
    } else {
      res.send(JSON.stringify(data["Buckets"]));
    }
  });
});

app.listen(port, () => {
  console.log(`Example app listening at ${port}`);
});
