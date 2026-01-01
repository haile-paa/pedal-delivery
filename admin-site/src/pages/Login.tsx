import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../contexts/AuthContext";
import { authAPI } from "../services/api";

interface PhoneFormData {
  phone: string;
}

interface OTPFormData {
  otp: string;
}

const Login: React.FC = () => {
  const { sendOTP, verifyOTP } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [phone, setPhone] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);

  const phoneForm = useForm<PhoneFormData>({
    defaultValues: {
      phone: "",
    },
  });

  const otpForm = useForm<OTPFormData>({
    defaultValues: {
      otp: "",
    },
  });

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async (data: PhoneFormData) => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      // Validate phone number
      const phoneRegex = /^(?:\+251|0)?9\d{8}$/;
      if (!phoneRegex.test(data.phone)) {
        setError(
          "Please enter a valid Ethiopian phone number (e.g., 0912345678)"
        );
        return;
      }

      await sendOTP(data.phone, "admin");

      setPhone(data.phone);
      setOtpSent(true);
      setStep("otp");
      setCountdown(60); // 60 seconds countdown
      setSuccess("OTP sent successfully! Check your phone for the code.");

      // Store in local storage for verification
      localStorage.setItem("pending_phone", data.phone);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (data: OTPFormData) => {
    try {
      setLoading(true);
      setError("");

      const pendingPhone = localStorage.getItem("pending_phone") || phone;

      if (!pendingPhone) {
        setError("Phone number not found. Please start over.");
        setStep("phone");
        return;
      }

      await verifyOTP(pendingPhone, data.otp, "admin");

      // Redirect to dashboard
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    try {
      setLoading(true);
      setError("");

      const pendingPhone = localStorage.getItem("pending_phone") || phone;

      if (!pendingPhone) {
        setError("Phone number not found. Please enter your phone again.");
        setStep("phone");
        return;
      }

      await sendOTP(pendingPhone, "admin");

      setCountdown(60);
      setSuccess("OTP resent successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep("phone");
    setError("");
    setSuccess("");
    phoneForm.reset();
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-gray-100'>
      <div className='flex min-h-screen'>
        {/* Left side - Info */}
        <div className='hidden w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-12 lg:block'>
          <div className='flex h-full flex-col justify-between'>
            <div>
              <h1 className='text-4xl font-bold text-white'>FoodAdmin</h1>
              <p className='mt-4 text-lg text-blue-100'>
                Manage your food delivery platform with ease
              </p>
              <p className='mt-2 text-blue-200'>
                Complete control over restaurants, drivers, and orders.
                <br />
                Real-time analytics and seamless management in one powerful
                dashboard.
              </p>
            </div>

            <div className='grid grid-cols-3 gap-8'>
              <div>
                <h3 className='text-3xl font-bold text-white'>150+</h3>
                <p className='text-blue-200'>Restaurants</p>
              </div>
              <div>
                <h3 className='text-3xl font-bold text-white'>45+</h3>
                <p className='text-blue-200'>Active Drivers</p>
              </div>
              <div>
                <h3 className='text-3xl font-bold text-white'>10K+</h3>
                <p className='text-blue-200'>Orders/Month</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className='flex w-full flex-col justify-center p-8 lg:w-1/2'>
          <div className='mx-auto w-full max-w-md'>
            <div className='lg:hidden mb-8'>
              <h1 className='text-3xl font-bold text-gray-800'>FoodAdmin</h1>
            </div>

            <div className='rounded-2xl bg-white p-8 shadow-lg'>
              <h2 className='text-2xl font-bold text-gray-800'>Welcome back</h2>
              <p className='mt-2 text-gray-600'>
                {step === "phone"
                  ? "Sign in to your admin account to continue"
                  : `Enter OTP sent to ${
                      phone || localStorage.getItem("pending_phone")
                    }`}
              </p>

              {error && (
                <div className='mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600'>
                  {error}
                </div>
              )}

              {success && (
                <div className='mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-600'>
                  {success}
                </div>
              )}

              {step === "phone" ? (
                // Phone Number Form
                <form
                  onSubmit={phoneForm.handleSubmit(handleSendOTP)}
                  className='mt-8 space-y-6'
                >
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>
                      Phone Number *
                    </label>
                    <div className='mt-1 flex'>
                      <span className='inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500'>
                        +251
                      </span>
                      <input
                        {...phoneForm.register("phone", {
                          required: "Phone number is required",
                          pattern: {
                            value: /^(?:0)?9\d{8}$/,
                            message:
                              "Enter a valid Ethiopian phone number (e.g., 0912345678)",
                          },
                        })}
                        type='tel'
                        className={`block w-full rounded-r-lg border px-4 py-3 ${
                          phoneForm.formState.errors.phone
                            ? "border-red-300"
                            : "border-gray-300"
                        } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                        placeholder='912345678'
                      />
                    </div>
                    {phoneForm.formState.errors.phone && (
                      <p className='mt-1 text-sm text-red-600'>
                        {phoneForm.formState.errors.phone.message}
                      </p>
                    )}
                    <p className='mt-1 text-xs text-gray-500'>
                      Enter your Ethiopian phone number (e.g., 0912345678)
                    </p>
                  </div>

                  <button
                    type='submit'
                    disabled={loading}
                    className='w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50'
                  >
                    {loading ? "Sending OTP..." : "Send OTP"}
                  </button>

                  <div className='rounded-lg bg-blue-50 p-4'>
                    <p className='text-sm text-blue-800'>
                      <strong>Demo phone:</strong> 0911111111
                    </p>
                    <p className='mt-1 text-xs text-blue-700'>
                      For development, OTP will be logged in backend console
                    </p>
                  </div>
                </form>
              ) : (
                // OTP Verification Form
                <form
                  onSubmit={otpForm.handleSubmit(handleVerifyOTP)}
                  className='mt-8 space-y-6'
                >
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>
                      Enter 6-digit OTP *
                    </label>
                    <input
                      {...otpForm.register("otp", {
                        required: "OTP is required",
                        pattern: {
                          value: /^\d{6}$/,
                          message: "OTP must be 6 digits",
                        },
                      })}
                      type='text'
                      maxLength={6}
                      className={`mt-1 w-full rounded-lg border px-4 py-3 text-center text-2xl tracking-widest ${
                        otpForm.formState.errors.otp
                          ? "border-red-300"
                          : "border-gray-300"
                      } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                      placeholder='123456'
                      autoComplete='one-time-code'
                    />
                    {otpForm.formState.errors.otp && (
                      <p className='mt-1 text-sm text-red-600'>
                        {otpForm.formState.errors.otp.message}
                      </p>
                    )}
                  </div>

                  <div className='space-y-4'>
                    <button
                      type='submit'
                      disabled={loading}
                      className='w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50'
                    >
                      {loading ? "Verifying..." : "Verify OTP"}
                    </button>

                    <button
                      type='button'
                      onClick={handleBackToPhone}
                      disabled={loading}
                      className='w-full rounded-lg border border-gray-300 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                    >
                      Back
                    </button>

                    <div className='text-center'>
                      <button
                        type='button'
                        onClick={handleResendOTP}
                        disabled={countdown > 0 || loading}
                        className={`text-sm ${
                          countdown > 0
                            ? "text-gray-400"
                            : "text-blue-600 hover:text-blue-500"
                        }`}
                      >
                        {countdown > 0
                          ? `Resend OTP in ${countdown}s`
                          : "Didn't receive code? Resend OTP"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
