import { useState } from "react";
import "./index.css";

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [counterOffer, setCounterOffer] = useState(null);
  const [graphs, setGraphs] = useState(null)
  const [loadingGraphs, setLoadingGraphs] = useState(false)

  // --- NEW: State to hold our guardrail warnings ---
  const [validationError, setValidationError] = useState(null);

  const [formData, setFormData] = useState({
    Gender: 1,
    Married: 1,
    Dependents: 0,
    Education: 1,
    Self_Employed: 0,
    ApplicantIncome: 5000,
    CoapplicantIncome: 0,
    LoanAmount: 150,
    Loan_Amount_Term: 360,
    Credit_History: 1.0,
    Property_Area: 2,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    // If the input is empty, leave it as an empty string. Otherwise, convert to number.
    setFormData({ ...formData, [name]: value === "" ? "" : parseFloat(value) });
  };
  
  const analyzeMetrics = () => {
    const tags = [];
    const totalIncome = formData.ApplicantIncome + formData.CoapplicantIncome;
    const ratio = formData.LoanAmount / (totalIncome || 1);

    // 1. Credit History Check
    if (formData.Credit_History === 0) {
      tags.push({ label: "Critical: Bad Credit History", type: "danger" });
    } else {
      tags.push({ label: "Positive: Good Credit History", type: "success" });
    }

    // 2. The Smart Income Ratio Check (Syncs with AI result)
    if (result === false && formData.Credit_History === 1.0) {
      // If AI rejected them despite good credit, the ratio is definitely the problem!
      tags.push({ label: "Warning: Loan Exceeds Safe Income Multiplier", type: "warning" });
    } else if (ratio >= 40) {
      // Catch extreme ratios even before the AI finishes
      tags.push({ label: "Warning: High Debt-to-Income Ratio", type: "warning" });
    } else {
      tags.push({ label: "Optimal: Healthy Income Ratio", type: "success" });
    }

    return tags;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Clear old states
    setValidationError(null);
    setResult(null);
    setCounterOffer(null);

    // CURRENT EXCHANGE RATE: 1 USD = ~83 INR
    const EXCHANGE_RATE = 83; 

    const totalIncomeINR = formData.ApplicantIncome + formData.CoapplicantIncome;

    // --- NEW: THE INR GUARDRAILS (Input Validation) ---
    if (
      formData.ApplicantIncome < 0 ||
      formData.CoapplicantIncome < 0 ||
      formData.LoanAmount < 0
    ) {
      setValidationError("Error: Financial values cannot be negative.");
      return; 
    }
    if (totalIncomeINR <= 0) {
      setValidationError(
        "Error: Total household income must be greater than ₹0 to apply.",
      );
      return;
    }
    if (formData.LoanAmount <= 0) {
      setValidationError(
        "Error: Minimum loan request must be at least ₹100,000.",
      );
      return;
    }
    // Updated limits for INR (e.g., $1M USD = ₹8.3 Crores)
    if (totalIncomeINR > (1000000 * EXCHANGE_RATE)) {
      setValidationError(
        "Notice: Incomes over ₹8.3 Crores exceed automated underwriting limits.",
      );
      return;
    }
    if (formData.LoanAmount > (5000000 * EXCHANGE_RATE)) {
      setValidationError(
        "Notice: Automated approvals are capped at ₹41.5 Crores.",
      );
      return;
    }
    // --------------------------------------------------

    setLoading(true);

    // --- TRANSLATION LAYER: Convert INR to USD for the AI ---
   // --- TRANSLATION LAYER: Convert INR to USD for the AI ---
    const apiPayload = {
      ...formData,
      ApplicantIncome: formData.ApplicantIncome / EXCHANGE_RATE,
      CoapplicantIncome: formData.CoapplicantIncome / EXCHANGE_RATE,
      // CRITICAL FIX: The Kaggle AI expects the loan in THOUSANDS of USD. 
      // We divide by 83 to get USD, then divide by 1000 so the AI understands it.
      LoanAmount: (formData.LoanAmount / EXCHANGE_RATE) / 1000
    };

    try {
      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload), 
      });
      const data = await response.json();

      setResult(data.approved);
      setConfidence(data.confidence);
      
      // TRANSLATION LAYER: Convert the USD counter-offer back to INR
      if (data.counter_offer) {
        // The AI returns the offer in thousands of USD (e.g., 115).
        // Multiply by 1000 to get full USD, then by 83 to get full INR!
        const offerInRupees = Math.round(data.counter_offer * 1000 * EXCHANGE_RATE);
        setCounterOffer(offerInRupees); 
      }
      
    } catch (error) {
      console.error(error);
      alert("Could not connect to the AI. Is your Python server running?");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingGraphs(true)
    try {
      const response = await fetch('http://127.0.0.1:8000/analytics')
      const data = await response.json()
      setGraphs(data)
    } catch (error) {
      console.error("Failed to fetch graphs", error)
    } finally {
      setLoadingGraphs(false)
    }
  }
  return (
    <div className="layout-wrapper">
      <nav className="top-nav">
        <div className="nav-left">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          <span className="nav-brand">QuickLoan AI</span>
          {/* <span className="nav-badge">INTERNAL TOOL</span> */}
        </div>
        <div className="nav-right">
          {/* <div className="nav-status"><div className="status-dot"></div><span>API Online</span></div> */}
          <a
            href="https://github.com/Abhinav-Anil-5670/QuickLoan"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"
              />
            </svg>
            GitHub
          </a>
        </div>
      </nav>

      <main className="app-main">
        <div className="app-container">
          <div className="dashboard-card">
            <div className="dashboard-left">
              <div className="header-simple">
                <h1 className="title-simple">Underwriting Engine</h1>
                <p className="subtitle-simple"> •••• Awaiting Input</p>
              </div>

              {/* --- NEW: Display the Validation Error if it exists --- */}
              {validationError && (
                <div className="validation-banner">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{validationError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="loan-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Your Monthly Income (₹)</label>
                    <input
                      type="number"
                      name="ApplicantIncome"
                      value={formData.ApplicantIncome}
                      onChange={handleChange}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Co-Applicant Monthly Income (₹)
                    </label>
                    <input
                      type="number"
                      name="CoapplicantIncome"
                      value={formData.CoapplicantIncome}
                      onChange={handleChange}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Loan Amount
                    </label>
                    <input
                      type="number"
                      name="LoanAmount"
                      value={formData.LoanAmount}
                      onChange={handleChange}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit History</label>
                    <select
                      name="Credit_History"
                      value={formData.Credit_History}
                      onChange={handleChange}
                      className="form-input"
                    >
                      <option value={1.0}>Good (Meets Guidelines)</option>
                      <option value={0.0}>
                        Bad (Does Not Meet Guidelines)
                      </option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Education</label>
                    <select
                      name="Education"
                      value={formData.Education}
                      onChange={handleChange}
                      className="form-input"
                    >
                      <option value={1}>Graduate</option>
                      <option value={0}>Not Graduate</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Property Area</label>
                    <select
                      name="Property_Area"
                      value={formData.Property_Area}
                      onChange={handleChange}
                      className="form-input"
                    >
                      <option value={2}>Urban</option>
                      <option value={1}>Semi-Urban</option>
                      <option value={0}>Rural</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`submit-btn ${loading ? "btn-loading" : ""}`}
                >
                  {loading ? "Processing Data..." : "Run Analysis"}
                </button>
              </form>
            </div>

            <div className="dashboard-right">
              <div className="console-wrapper">
                {loading && (
                  <div className="console-status">
                    <div className="spinner"></div>
                    <p>Running Random Forest Model...</p>
                  </div>
                )}
                {!loading && result === null && (
                  <div className="console-status">
                    <div className="pulse-dot"></div>
                    <p>System ready. Enter parameters to begin.</p>
                  </div>
                )}
                {!loading && result !== null && (
                  <div
                    className={`result-box ${result ? "result-success" : "result-error"}`}
                  >
                    <h2 className="result-title">
                      {result ? "STATUS: APPROVED" : "STATUS: REJECTED"}
                    </h2>
                    <p className="result-desc">
                      {result
                        ? "The application meets the required mathematical thresholds."
                        : "The model identified high-risk factors. Application denied."}
                    </p>

                    {!result && counterOffer && (
                      <div className="counter-offer-alert">
                        <div className="counter-offer-icon">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                          </svg>
                        </div>
                        <div className="counter-offer-text">
                          <strong>Counter-Offer Available</strong>
                          <p>
                            You are pre-approved for a revised loan amount of{" "}
                            {/* Format the number with commas and add the Rupee symbol! */}
                            <span>₹{counterOffer.toLocaleString('en-IN')}</span> based on current
                            income ratios.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="confidence-section">
                      <div className="confidence-header">
                        <span className="confidence-label">
                          Model Confidence
                        </span>
                        <span className="confidence-value">
                          {(confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="confidence-bar-bg">
                        <div
                          className="confidence-bar-fill"
                          style={{
                            width: `${confidence * 100}%`,
                            backgroundColor: result ? "#4ade80" : "#f87171",
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="tags-container">
                      <p className="tags-title">Key Deciding Factors:</p>
                      <div className="tags-list">
                        {analyzeMetrics().map((tag, index) => (
                          <span key={index} className={`tag tag-${tag.type}`}>
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* --- NEW: AI ANALYTICS DASHBOARD --- */}
      <section className="analytics-section">
        <div className="app-container">
          <div className="analytics-header">
            <h2>Model Analytics & Explainability</h2>
            <button onClick={fetchAnalytics} disabled={loadingGraphs} className="btn-secondary">
              {loadingGraphs ? 'Generating via Python...' : 'Load Data Visualizations'}
            </button>
          </div>

          {graphs && (
            <div className="graphs-grid">
              
              <div className="graph-card">
                <img src={graphs.importance} alt="Feature Importance" />
                <p className="graph-label">Horizontal Bar Chart</p>
              </div>
              
              <div className="graph-card">
                <img src={graphs.matrix} alt="Confusion Matrix" />
                <p className="graph-label">Heatmap</p>
              </div>
              
              <div className="graph-card">
                <img src={graphs.scatter} alt="Decision Boundary" />
                <p className="graph-label">Scatter Plot</p>
              </div>
              
              <div className="graph-card">
                <img src={graphs.heatmap} alt="Correlation Heatmap" />
                <p className="graph-label">Correlation Matrix (Heatmap)</p>
              </div>

            </div>
          )}
        </div>
      </section>

      <footer className="bottom-footer">
        <p>
          CONFIDENTIAL AND PROPRIETARY. For demonstration purposes only. Not a
          real financial risk assessment tool.
        </p>
        <p className="footer-copyright">
          © 2026 QuickLoan AI Model. Powered by scikit-learn & FastAPI.
        </p>
      </footer>
    </div>
  );
}

export default App;
