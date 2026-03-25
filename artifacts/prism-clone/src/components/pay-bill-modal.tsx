import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { formatCurrency } from "@/lib/utils";
import { X, CreditCard, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL + "api";

// Load Stripe publishable key once
let stripePromise: ReturnType<typeof loadStripe> | null = null;

async function getStripePromise() {
  if (!stripePromise) {
    const res = await fetch(`${API_BASE}/payments/config`);
    const { publishableKey } = await res.json();
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

// Inner form rendered inside <Elements>
function CheckoutForm({
  billInstanceId,
  billerName,
  amountCents,
  onSuccess,
  onClose,
}: {
  billInstanceId: number;
  billerName: string;
  amountCents: number;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setPaying(true);

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message ?? "Card error");
      setPaying(false);
      return;
    }

    // Get clientSecret from elements (already injected by Elements)
    const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmErr) {
      setError(confirmErr.message ?? "Payment failed");
      setPaying(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      // Tell the server to mark the bill paid
      try {
        const res = await fetch(`${API_BASE}/payments/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billInstanceId, paymentIntentId: paymentIntent.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Confirmation failed");
        setPaymentIntentId(paymentIntent.id);
        setSucceeded(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } catch (err: any) {
        setError(err.message || "Payment succeeded but could not mark bill as paid. Please refresh.");
      }
    } else {
      setError(`Unexpected payment status: ${paymentIntent?.status}`);
    }
    setPaying(false);
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white">Payment Successful!</h3>
        <p className="text-muted-foreground text-sm text-center">
          {billerName} — {formatCurrency(amountCents / 100)} paid and bill marked as paid.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Paying</p>
          <p className="font-semibold text-white">{billerName}</p>
        </div>
        <p className="text-2xl font-display font-bold text-primary">{formatCurrency(amountCents / 100)}</p>
      </div>

      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {error && (
        <div className="flex items-start gap-2 text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || paying}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/80 disabled:opacity-50 transition-colors"
        >
          {paying ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
          ) : (
            <><CreditCard className="w-4 h-4" /> Pay {formatCurrency(amountCents / 100)}</>
          )}
        </button>
      </div>
    </form>
  );
}

// Main exported modal — fetches the PaymentIntent, then renders Elements
export function PayBillModal({
  billInstanceId,
  onSuccess,
  onClose,
}: {
  billInstanceId: number;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripe, setStripe] = useState<Awaited<ReturnType<typeof loadStripe>> | null>(null);
  const [amountCents, setAmountCents] = useState(0);
  const [billerName, setBillerName] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sp, intentRes] = await Promise.all([
          getStripePromise(),
          fetch(`${API_BASE}/payments/create-intent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ billInstanceId }),
          }),
        ]);

        const intentData = await intentRes.json();
        if (!intentRes.ok) throw new Error(intentData?.error || "Failed to set up payment.");

        if (!cancelled) {
          setStripe(sp);
          setClientSecret(intentData.clientSecret);
          setAmountCents(intentData.amountCents);
          setBillerName(intentData.billerName);
        }
      } catch (err: any) {
        if (!cancelled) setFetchError(err.message || "Could not load payment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [billInstanceId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-panel rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-white">Pay Bill</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Setting up payment…</p>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center py-10 gap-4 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <p className="text-white font-semibold">Could not set up payment</p>
            <p className="text-sm text-muted-foreground">{fetchError}</p>
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white transition-colors">
              Close
            </button>
          </div>
        ) : clientSecret && stripe ? (
          <Elements
            stripe={stripe}
            options={{
              clientSecret,
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#8b5cf6",
                  colorBackground: "#1a1a2e",
                  colorText: "#ffffff",
                  colorDanger: "#f87171",
                  borderRadius: "12px",
                  fontFamily: "'Inter', sans-serif",
                },
              },
            }}
          >
            <CheckoutForm
              billInstanceId={billInstanceId}
              billerName={billerName}
              amountCents={amountCents}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          </Elements>
        ) : null}
      </div>
    </div>
  );
}
