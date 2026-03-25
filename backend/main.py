from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pickle
import pandas as pd

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
        while test_amount >= 10:
            test_amount -= 5
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