"use client";

import {
  LockKeyhole,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import {
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


export function LoginForm() {
  const router =
    useRouter();

  const [pin, setPin] =
    useState("");

  const [error, setError] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);


  async function submit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!pin.trim()) {
      return;
    }

    setLoading(true);

    setError("");

    try {
      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                pin,
              }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.error ??
            "Authentication failed"
        );
      }


      router.replace("/");

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Authentication failed"
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="auth-shell">

      <section className="auth-card">

        <div className="auth-lock">
          <LockKeyhole
            size={27}
          />
        </div>


        <div className="auth-heading">
          <span>
            PRIVATE WORKSPACE
          </span>

          <h1>
            Project Control
          </h1>

          <p>
            Enter your PIN to
            access the dashboard.
          </p>
        </div>


        <form
          onSubmit={submit}
          className="auth-form"
        >

          <label>
            <span>
              Access PIN
            </span>

            <input
              type="password"

              inputMode="numeric"

              autoComplete="off"

              autoFocus

              value={pin}

              onChange={(
                event
              ) =>
                setPin(
                  event.target
                    .value
                )
              }

              placeholder="••••••"

              disabled={
                loading
              }
            />
          </label>


          {error && (
            <p className="auth-error">
              {error}
            </p>
          )}


          <button
            type="submit"
            className="auth-submit"
            disabled={
              loading ||
              !pin.trim()
            }
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={17}
                  className="spin"
                />

                Verifying
              </>
            ) : (
              <>
                <ShieldCheck
                  size={17}
                />

                Unlock dashboard
              </>
            )}
          </button>

        </form>


        <div className="auth-session-note">
          <ShieldCheck
            size={14}
          />

          Session expires
          automatically after
          10 minutes.
        </div>

      </section>

    </main>
  );
}