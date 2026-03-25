import pandas as pd
import pickle
from sklearn.ensemble import RandomForestClassifier

print("Loading data...")
df = pd.read_csv('loan_data.csv')
df = df.dropna()

print("Cleaning data...")
df['Gender'] = df['Gender'].map({'Male': 1, 'Female': 0})
df['Married'] = df['Married'].map({'Yes': 1, 'No': 0})
df['Dependents'] = df['Dependents'].replace('3+', '3').astype(int)
df['Education'] = df['Education'].map({'Graduate': 1, 'Not Graduate': 0})
df['Self_Employed'] = df['Self_Employed'].map({'Yes': 1, 'No': 0})
df['Property_Area'] = df['Property_Area'].map({'Rural': 0, 'Semiurban': 1, 'Urban': 2})
df['Loan_Status'] = df['Loan_Status'].map({'Y': 1, 'N': 0})

# --- THE UPGRADE: FEATURE ENGINEERING ---
# 1. Combine incomes for a true household total
df['Total_Income'] = df['ApplicantIncome'] + df['CoapplicantIncome']

# 2. Create the crucial ratio (LoanAmount is in thousands, so we multiply by 1000)
df['Loan_Income_Ratio'] = (df['LoanAmount'] * 1000) / df['Total_Income']

# 3. Drop the raw, confusing numbers so the AI is forced to look at our smart ratios
X = df.drop(['Loan_Status', 'Loan_ID', 'ApplicantIncome', 'CoapplicantIncome', 'LoanAmount'], axis=1)
y = df['Loan_Status']

print("Training upgraded AI...")
# We add max_depth=5 to stop the AI from memorizing weird outliers!
model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
model.fit(X, y)

with open('model.pkl', 'wb') as file:
    pickle.dump(model, file)

print("✅ SUCCESS! V2 Model trained and saved!")
print("The AI now strictly looks at these factors:", list(X.columns))