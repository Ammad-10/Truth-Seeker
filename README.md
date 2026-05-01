# TruthSeeker — Complete Training & Deployment Guide
## From Zero to Production on AWS / Azure

---

## 📁 Project Structure

```
truthseeker/
├── data/
│   └── download_datasets.py     ← Download all 4 datasets
├── training/
│   ├── train.py                 ← Main training script
│   ├── inference.py             ← Model inference engine
│   └── requirements.txt        ← Python dependencies
├── aws/
│   └── sagemaker_train.py       ← AWS SageMaker job launcher
├── azure/
│   └── azure_train.py           ← Azure ML job launcher
└── deployment/
    ├── app.py                   ← Flask REST API server
    └── Dockerfile               ← Production container
```

---

## STEP 1 — Set Up Your Local Environment

```bash
# Clone your project repo
git clone https://github.com/YOUR_USERNAME/truthseeker.git
cd truthseeker

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Linux/Mac
venv\Scripts\activate             # Windows

# Install dependencies
pip install -r training/requirements.txt
```

---

## STEP 2 — Download Datasets

### Option A: Automatic Download (Recommended)

**Set up Kaggle API key first:**
1. Go to https://www.kaggle.com/account
2. Click **"Create New API Token"** → downloads `kaggle.json`
3. Place it at `~/.kaggle/kaggle.json`
4. `chmod 600 ~/.kaggle/kaggle.json`

```bash
# Download ALL datasets at once
python data/download_datasets.py --all --output_dir ./data

# Verify downloads
python data/download_datasets.py --verify --output_dir ./data
```

### Option B: Manual Download

| Dataset | Link | File to place in `./data/` |
|---------|------|---------------------------|
| ISOT | https://www.kaggle.com/datasets/clmentbisaillon/fake-and-real-news-dataset | `True.csv`, `Fake.csv` |
| WELFake | https://www.kaggle.com/datasets/saurabhshahane/fake-news-classification | `WELFake_Dataset.csv` |
| LIAR | https://www.cs.ucsb.edu/~william/data/liar_dataset.zip | extract to `./data/liar/` |
| FakeNewsNet | https://github.com/KaiDMML/FakeNewsNet | `./data/fakenewsnet/*.csv` |

**Expected after download:**
```
data/
├── True.csv                     (23,481 rows)
├── Fake.csv                     (21,417 rows)
├── WELFake_Dataset.csv          (72,134 rows)
├── liar/
│   ├── train.tsv                (10,269 rows)
│   ├── valid.tsv                (1,284 rows)
│   └── test.tsv                 (1,283 rows)
└── fakenewsnet/
    ├── politifact_real.csv
    ├── politifact_fake.csv
    ├── gossipcop_real.csv
    └── gossipcop_fake.csv
```

---

## STEP 3A — Train on AWS SageMaker ☁️

### Prerequisites
```bash
# Install AWS CLI
pip install awscli boto3 sagemaker
aws configure
# Enter: Access Key ID, Secret Key, Region (us-east-1), Output (json)
```

### Create IAM Role (once)
1. Go to AWS Console → IAM → Roles → Create Role
2. Select **SageMaker** as trusted entity
3. Attach policies: `AmazonSageMakerFullAccess` + `AmazonS3FullAccess`
4. Name it: `SageMakerTruthSeekerRole`

### Launch Training
```bash
# Edit aws/sagemaker_train.py:
#   AWS_REGION = "us-east-1"
#   S3_BUCKET  = "your-unique-bucket-name"

# Step 1: Upload datasets to S3 (run once)
python aws/sagemaker_train.py --upload --data_dir ./data

# Step 2: Estimate cost
python aws/sagemaker_train.py --cost

# Step 3: Launch training job (Spot instance = 70% cheaper!)
python aws/sagemaker_train.py --train

# Step 4: Monitor in AWS Console
# https://console.aws.amazon.com/sagemaker → Training Jobs

# Step 5: Download trained model
python aws/sagemaker_train.py --download YOUR-JOB-NAME
```

**💰 Cost: ~$0.30-0.60 total for full training (spot instance)**

---

## STEP 3B — Train on Azure ML ☁️

### Prerequisites
```bash
pip install azure-ai-ml azure-identity
az login          # installs via: https://docs.microsoft.com/cli/azure/install-azure-cli
```

### Create Azure Resources (once)
```bash
# Create Resource Group
az group create --name truthseeker-rg --location eastus

# Create Azure ML Workspace
az ml workspace create \
  --name truthseeker-ws \
  --resource-group truthseeker-rg \
  --location eastus
```

### Launch Training
```bash
# Edit azure/azure_train.py:
#   SUBSCRIPTION_ID = "your-subscription-id"  (Azure Portal → Subscriptions)
#   RESOURCE_GROUP  = "truthseeker-rg"
#   WORKSPACE_NAME  = "truthseeker-ws"

# Step 1: Estimate cost
python azure/azure_train.py --cost

# Step 2: Create GPU cluster + environment (run once)
python azure/azure_train.py --setup

# Step 3: Upload datasets
python azure/azure_train.py --upload --data_dir ./data

# Step 4: Submit training job
python azure/azure_train.py --train
# Save the printed JOB_NAME!

# Step 5: Monitor
# https://ml.azure.com → Experiments → truthseeker-training

# Step 6: Wait for completion
python azure/azure_train.py --wait YOUR-JOB-NAME

# Step 7: Download model
python azure/azure_train.py --download YOUR-JOB-NAME

# Step 8: Register model for deployment
python azure/azure_train.py --register YOUR-JOB-NAME
```

**💰 Cost: ~$0.25-0.50 total (low-priority NC4as_T4_v3)**

---

## STEP 3C — Train Locally (No Cloud)

If you have a GPU locally (or just want to test):

```bash
# With GPU
python training/train.py \
  --data_dir ./data \
  --output_dir ./model_output \
  --epochs 6 \
  --fp16

# CPU only (slower, for testing)
python training/train.py \
  --data_dir ./data \
  --output_dir ./model_output \
  --epochs 2
```

---

## STEP 4 — Deploy the API

### Local Testing
```bash
# Set environment variables
export MODEL_PATH=./model_output/final_model
export NEWSAPI_KEY=your_newsapi_key_here   # get at https://newsapi.org
export JWT_SECRET=your-secret-key-here

# Start Flask API
python deployment/app.py
# → Running on http://0.0.0.0:5000

# Test it
curl -X POST http://localhost:5000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"text": "Scientists discover water on Mars confirmed by NASA"}'
```

### Production Deploy (Docker)
```bash
# Build image
docker build -f deployment/Dockerfile -t truthseeker-api .

# Run with model mounted
docker run -d \
  -p 5000:5000 \
  -v ./model_output/final_model:/app/model \
  -e NEWSAPI_KEY=your_key \
  -e JWT_SECRET=your_secret \
  truthseeker-api
```

### Deploy to AWS EC2
```bash
# SSH into your EC2 instance (t3.medium for inference, no GPU needed)
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Install Docker
sudo apt update && sudo apt install docker.io -y
sudo usermod -aG docker ubuntu

# Pull and run
docker pull your-dockerhub/truthseeker-api
docker run -d -p 80:5000 ... truthseeker-api
```

### Deploy to Azure Container Apps
```bash
az containerapp create \
  --name truthseeker-api \
  --resource-group truthseeker-rg \
  --image your-registry/truthseeker-api \
  --target-port 5000 \
  --ingress external \
  --min-replicas 1 --max-replicas 5
```

---

## STEP 5 — Connect to Your Frontend

Update your React app's API calls to point to your backend:

```javascript
// In your React app (e.g., src/api.js)
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export const verifyNews = async (text) => {
  const response = await fetch(`${API_BASE}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return response.json();
};

export const verifyImage = async (base64Image) => {
  const response = await fetch(`${API_BASE}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image }),
  });
  return response.json();
};
```

---

## API Response Format

```json
{
  "credibility_score": 78,
  "verdict": "VERIFIED",
  "nlp_confidence": 82,
  "api_evidence": 75,
  "linguistic_flags": [],
  "input_type": "text",
  "inference_ms": 43.2,
  "total_ms": 312.5
}
```

---

## Expected Model Performance

| Metric    | Target  | After training |
|-----------|---------|----------------|
| Accuracy  | > 93%   | 93-96% |
| F1 Score  | > 0.93  | 0.93-0.96 |
| Inference | < 100ms | 40-80ms (T4 GPU) |
| Model size | < 100MB | ~85MB (INT8) |

---

## Cost Summary

| Option | Instance | Time | Cost |
|--------|----------|------|------|
| AWS SageMaker Spot | ml.g4dn.xlarge | ~1.5h | ~$0.35 |
| Azure Low-Priority | NC4as_T4_v3 | ~1.5h | ~$0.25 |
| AWS On-Demand | ml.g4dn.xlarge | ~1.5h | ~$1.10 |

---

## Troubleshooting

**"CUDA out of memory"** → Reduce `BATCH_SIZE` to 16 in `train.py`

**"Kaggle API error"** → Check `~/.kaggle/kaggle.json` permissions (`chmod 600`)

**"Model not found"** → Set `MODEL_PATH` env variable to correct path

**"NewsAPI 0 results"** → Normal for very short text; API evidence defaults to 50 (neutral)

**SageMaker job fails** → Check CloudWatch logs: AWS Console → CloudWatch → Log Groups → `/aws/sagemaker/TrainingJobs`

**Azure job fails** → Check logs: Azure ML Studio → Experiments → Your Run → Outputs + Logs

---

*TruthSeeker — University of Lahore CS Dept. · Project F25-74*
