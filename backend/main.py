from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pickle
import pandas as pd
import io
import base64
import numpy as np
import matplotlib
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import confusion_matrix

# This forces matplotlib to generate images in the background without opening windows
matplotlib.use('Agg')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

with open("model.pkl", "rb") as file:
    model = pickle.load(file)

class LoanApplication(BaseModel):
    Gender: int
    Married: int
    Dependents: int
    Education: int
    Self_Employed: int
    ApplicantIncome: float
    CoapplicantIncome: float
    LoanAmount: float
    Loan_Amount_Term: float
    Credit_History: float
    Property_Area: int

@app.post("/predict")
def predict_loan(application: LoanApplication):
    total_income = application.ApplicantIncome + application.CoapplicantIncome
    if total_income == 0: total_income = 1 
        
    loan_income_ratio = (application.LoanAmount * 1000) / total_income

    model_input = {
        "Gender": application.Gender,
        "Married": application.Married,
        "Dependents": application.Dependents,
        "Education": application.Education,
        "Self_Employed": application.Self_Employed,
        "Loan_Amount_Term": application.Loan_Amount_Term,
        "Credit_History": application.Credit_History,
        "Property_Area": application.Property_Area,
        "Total_Income": total_income,
        "Loan_Income_Ratio": loan_income_ratio
    }
    
    input_data = pd.DataFrame([model_input])
    prediction = model.predict(input_data)
    is_approved = bool(prediction[0])
    
    probabilities = model.predict_proba(input_data)[0]
    confidence = probabilities[1] if is_approved else probabilities[0]
    
    # --- NEW: PRESCRIPTIVE AI (THE COUNTER-OFFER ENGINE) ---
    counter_offer = None
    
    # If rejected, but they have GOOD credit, try to find a lower loan amount they can afford
    if not is_approved and application.Credit_History == 1.0:
        test_amount = application.LoanAmount
        
        # Keep lowering the loan by $5k until the AI says yes (stop at $10k minimum)
        # Stop at $1k minimum, drop by $1k at a time
        while test_amount >= 1: 
            test_amount -= 1
            test_ratio = (test_amount * 1000) / total_income
            
            # Create a temporary simulation input
            sim_input = model_input.copy()
            sim_input["Loan_Income_Ratio"] = test_ratio
            sim_df = pd.DataFrame([sim_input])
            
            # If the AI approves this new lower amount, save it and stop looking!
            if model.predict(sim_df)[0] == 1:
                counter_offer = test_amount
                break

    return {
        "approved": is_approved,
        "confidence": float(confidence),
        "counter_offer": counter_offer # Send the new offer to React!
    }


@app.get("/analytics")
def get_analytics():
    # 1. UI THEME CONFIGURATION (Matches React App)
    plt.style.use('dark_background')
    sns.set_theme(style="darkgrid", rc={
        "axes.facecolor": "#050505", "figure.facecolor": "#050505", 
        "grid.color": "#222222", "text.color": "#ffffff", 
        "axes.labelcolor": "#888888", "xtick.color": "#888888", 
        "ytick.color": "#888888", "font.family": "sans-serif"
    })
    
    # 2. GENERATE DATA (Using the same logic as our training set)
    np.random.seed(42)
    n = 800
    income = np.random.normal(60000, 25000, n).clip(10000)
    loan_amt = np.random.normal(150000, 75000, n).clip(10000)
    credit_hist = np.random.choice([0.0, 1.0], n, p=[0.2, 0.8])
    ratio = loan_amt / income
    approved = ((credit_hist == 1.0) & (ratio < 3.5)).astype(int)

    df = pd.DataFrame({
        'Total_Income': income, 'LoanAmount': loan_amt,
        'Loan_Income_Ratio': ratio, 'Credit_History': credit_hist,
        'Education': np.random.choice([0, 1], n),
        'Property_Area': np.random.choice([0, 1, 2], n),
        'Approved': approved
    })

    X = df.drop('Approved', axis=1)
    y = df['Approved']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    rf_model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
    rf_model.fit(X_train, y_train)

    # --- HELPER FUNCTION TO CONVERT GRAPH TO BASE64 ---
    def get_graph_base64():
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='#050505')
        buf.seek(0)
        image_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()
        return image_base64

    # --- GRAPH 1: FEATURE IMPORTANCE ---
    plt.figure(figsize=(6, 4))
    importances = rf_model.feature_importances_
    indices = np.argsort(importances)
    plt.barh(range(len(indices)), importances[indices], color="#6366f1")
    plt.yticks(range(len(indices)), [X.columns[i] for i in indices])
    plt.title('Feature Importance')
    plt.tight_layout()
    graph_importance = get_graph_base64()

    # --- GRAPH 2: CONFUSION MATRIX ---
    plt.figure(figsize=(6, 4))
    cm = confusion_matrix(y_test, rf_model.predict(X_test))
    sns.heatmap(cm, annot=True, fmt='d', cmap='mako', cbar=False, linewidths=1, linecolor='#222222')
    plt.title('Confusion Matrix')
    plt.xticks([0.5, 1.5], ['Rejected', 'Approved'])
    plt.yticks([0.5, 1.5], ['Rejected', 'Approved'], va='center')
    plt.tight_layout()
    graph_matrix = get_graph_base64()

    # --- GRAPH 3: SCATTER PLOT ---
    plt.figure(figsize=(6, 4))
    sns.scatterplot(data=df[df['Approved'] == 0], x='Total_Income', y='LoanAmount', color="#f87171", label='Rejected')
    sns.scatterplot(data=df[df['Approved'] == 1], x='Total_Income', y='LoanAmount', color="#4ade80", label='Approved')
    plt.title('Decision Boundary')
    plt.tight_layout()
    graph_scatter = get_graph_base64()

    # --- GRAPH 4: CORRELATION HEATMAP ---
    plt.figure(figsize=(6, 4))
    corr = df.corr()
    mask = np.triu(np.ones_like(corr, dtype=bool))
    sns.heatmap(corr, mask=mask, cmap='coolwarm', center=0, cbar=False, linewidths=0.5, linecolor='#050505')
    plt.title('Feature Correlation')
    plt.xticks(rotation=45, ha='right', fontsize=8)
    plt.yticks(fontsize=8)
    plt.tight_layout()
    graph_heatmap = get_graph_base64()

    # Send all 4 images to React as text strings!
    return {
        "importance": f"data:image/png;base64,{graph_importance}",
        "matrix": f"data:image/png;base64,{graph_matrix}",
        "scatter": f"data:image/png;base64,{graph_scatter}",
        "heatmap": f"data:image/png;base64,{graph_heatmap}"
    }