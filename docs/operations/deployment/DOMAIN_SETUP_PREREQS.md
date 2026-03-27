# Learnfyra Domain & Certificate Pre-Work Checklist
**Complete these steps before running CDK deploy with custom domains.**
**Estimated time: 30–45 minutes (most of it is waiting for certificate validation)**

---

## What You Need When Done

At the end of this checklist you will have four values to give back:

| Value | Where You'll Find It |
|---|---|
| `HOSTED_ZONE_ID` | Step 1 |
| `CLOUDFRONT_CERT_ARN` | Step 3 |
| `API_CERT_ARN` | Step 4 |
| `AWS_REGION` | The region where your API Gateway is deployed (default: `us-east-1`) |

---

## Step 1 — Find Your Route 53 Hosted Zone ID

Since you purchased the domain from AWS, Route 53 automatically created a hosted zone for you.

1. Open the [AWS Console](https://console.aws.amazon.com)
2. Search for **Route 53** in the top search bar → open it
3. In the left sidebar click **Hosted zones**
4. Find **learnfyra.com** in the list and click on it
5. On the hosted zone detail page, find the **Hosted zone ID** field (top right area)
   - It looks like: `Z0123456789ABCDEFGHIJ`
6. **Copy and save this value → this is your `HOSTED_ZONE_ID`**

> Verify: You should already see 2 records in the zone — an NS record and an SOA record.
> If you do NOT see the hosted zone, your domain may not have been fully provisioned yet.
> Wait 5 minutes and refresh.

---

## Step 2 — Confirm Your Deployment Region

Check what region you deployed to in GitHub Actions or CDK.

- Default for this project: **`us-east-1`**
- If you used a different region, note it down

> Good news: If you deployed to **us-east-1**, you only need ONE certificate for both
> CloudFront and API Gateway. If you used a different region, you need two certificates
> (one in us-east-1 for CloudFront, one in your region for API Gateway).

---

## Step 3 — Create ACM Certificate for CloudFront (MUST be us-east-1)

CloudFront **requires** the certificate to be in `us-east-1` regardless of where you deploy.

### 3a. Switch to us-east-1

In the AWS Console, look at the top-right region selector (next to your account name).
Click it and select **US East (N. Virginia) — us-east-1**.

> **CRITICAL:** Do not skip this. If you create the cert in the wrong region,
> CloudFront will not be able to use it and you will have to start over.

### 3b. Open ACM

Search for **Certificate Manager** in the top search bar → open it.

Make sure "N. Virginia" shows in the region indicator at the top right.

### 3c. Request the Certificate

1. Click **Request a certificate**
2. Select **Request a public certificate** → click **Next**
3. In the **Fully qualified domain name** field add these domains one by one
   (click **Add another name to this certificate** for each):

   ```
   learnfyra.com
   *.learnfyra.com
   *.dev.learnfyra.com
   *.qa.learnfyra.com
   ```

   > The wildcard `*.learnfyra.com` covers: `api.learnfyra.com`, `admin.learnfyra.com`
   > The wildcard `*.dev.learnfyra.com` covers: `web.dev`, `api.dev`, `admin.dev`, `auth.dev`
   > The wildcard `*.qa.learnfyra.com` covers: `web.qa`, `api.qa`, `admin.qa`
   > You need ALL four entries for the cert to cover every environment.

4. Validation method: select **DNS validation** (NOT email validation)
5. Key algorithm: leave as **RSA 2048**
6. Click **Request**

### 3d. Validate the Certificate (DNS Validation)

1. After requesting, you are taken to the certificate detail page
2. Status will show **Pending validation**
3. Expand each domain name entry — you will see a **CNAME name** and **CNAME value** for each
4. Click **Create records in Route 53** button (AWS will do this automatically for you
   since your domain is in Route 53)
   - A dialog will appear listing all the CNAME records to create
   - Click **Create records**
5. Wait 5–10 minutes for the status to change from **Pending validation** to **Issued**
   - Refresh the page every few minutes
   - DNS propagation can occasionally take up to 30 minutes

### 3e. Copy the Certificate ARN

Once status shows **Issued**:
1. At the top of the certificate detail page, find the **ARN** field
2. It looks like: `arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
3. **Copy and save this → this is your `CLOUDFRONT_CERT_ARN`**

---

## Step 4 — Create ACM Certificate for API Gateway

### If your deployment region is us-east-1 (most common)

You can **reuse the same certificate** from Step 3.
Your `API_CERT_ARN` = your `CLOUDFRONT_CERT_ARN` — same ARN, use it for both.

Skip to Step 5.

### If your deployment region is NOT us-east-1

You need a second certificate in your deployment region.

1. Switch the console region to **your deployment region** (top-right region selector)
2. Open **Certificate Manager** again
3. Request a new public certificate with the same four domain names as Step 3c
4. Validate with DNS → click **Create records in Route 53** again
5. Wait for **Issued** status
6. Copy the ARN → this is your `API_CERT_ARN`

---

## Step 5 — Verify Everything Before Handing Back

Run through this quick checklist:

```
□ Route 53 hosted zone for learnfyra.com exists and you have the Hosted Zone ID
□ ACM cert in us-east-1 — status is "Issued" (not "Pending validation")
□ Cert covers all four domains:
    □ learnfyra.com
    □ *.learnfyra.com
    □ *.dev.learnfyra.com
    □ *.qa.learnfyra.com
□ You have the CloudFront cert ARN (us-east-1)
□ You have the API cert ARN (same as CloudFront if using us-east-1)
□ You know your deployment region
```

---

## Step 6 — Share These Four Values

When you come back, share these four values and I'll wire everything up:

```
HOSTED_ZONE_ID=            (example: Z0123456789ABCDEFGHIJ)
CLOUDFRONT_CERT_ARN=       (example: arn:aws:acm:us-east-1:123456789012:certificate/...)
API_CERT_ARN=              (example: arn:aws:acm:us-east-1:123456789012:certificate/...)
AWS_REGION=                (example: us-east-1)
```

---

## Troubleshooting

**Certificate stuck on "Pending validation" after 30 minutes**
- Go to Route 53 → Hosted zones → learnfyra.com → check that the CNAME records exist
- If missing, go back to ACM → certificate → click "Create records in Route 53" again

**"Create records in Route 53" button is grayed out**
- This means Route 53 does not have access. Manually create the CNAME records:
  - Go to Route 53 → learnfyra.com hosted zone → Create record
  - Record type: CNAME
  - Name: copy the "CNAME name" from ACM (remove `.learnfyra.com.` from the end)
  - Value: copy the "CNAME value" from ACM
  - TTL: 300
  - Repeat for each domain entry in the certificate

**Can't find the CloudFront Certificate ARN field**
- On the certificate list page, click the certificate ID link to open the detail view
- The ARN is shown near the top of the page under the certificate ID

**Accidentally created cert in wrong region**
- Go to ACM in the wrong region → find the cert → delete it
- Switch to the correct region and start Step 3 again

---

## Reference — What Each Certificate Covers

| Environment | Hostnames | Certificate Required |
|---|---|---|
| Production | `learnfyra.com`, `api.learnfyra.com`, `admin.learnfyra.com` | `CLOUDFRONT_CERT_ARN` / `API_CERT_ARN` |
| QA/Staging | `web.qa.learnfyra.com`, `api.qa.learnfyra.com`, `admin.qa.learnfyra.com` | Same certs |
| Dev | `web.dev.learnfyra.com`, `api.dev.learnfyra.com`, `admin.dev.learnfyra.com`, `auth.dev.learnfyra.com` | Same certs |
