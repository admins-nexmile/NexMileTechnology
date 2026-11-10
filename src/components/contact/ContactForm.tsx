"use client";

import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Info, Loader2, Mail, Pencil, Send } from "lucide-react";
import { siteConfig } from "@/config/site";

type Values = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;

/**
 * idle:           editing the form
 * submitting:     sending to the configured endpoint
 * sent:           the endpoint confirmed receipt
 * error:          the endpoint failed
 * not-configured: input is valid but no endpoint exists, so nothing was sent
 */
type Status = "idle" | "submitting" | "sent" | "error" | "not-configured";

const subjects = [
  "General enquiry",
  "Services",
  "Solutions",
  "Training",
  "Careers",
  "Partnership",
  "Other",
];

const emptyValues: Values = { name: "", email: "", phone: "", subject: "", message: "" };
const fieldOrder: Field[] = ["name", "email", "phone", "subject", "message"];

const MESSAGE_MIN = 20;
const MESSAGE_MAX = 2000;

function validate(values: Values): Errors {
  const errors: Errors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();
  const message = values.message.trim();

  if (!name) errors.name = "Please enter your name.";
  else if (name.length < 2) errors.name = "Please enter at least 2 characters.";
  else if (name.length > 100) errors.name = "Please keep your name under 100 characters.";

  if (!email) errors.email = "Please enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Please enter a valid email address, e.g. name@company.com.";

  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (!/^[+\d][\d\s()-]*$/.test(phone) || digits.length < 7 || digits.length > 15) {
      errors.phone = "Please enter a valid phone number, or leave this field empty.";
    }
  }

  if (!values.subject) errors.subject = "Please choose a subject.";

  if (!message) errors.message = "Please enter your message.";
  else if (message.length < MESSAGE_MIN) errors.message = `Please add a little more detail (at least ${MESSAGE_MIN} characters).`;
  else if (message.length > MESSAGE_MAX) errors.message = `Please keep your message under ${MESSAGE_MAX} characters.`;

  return errors;
}

function buildMailto(values: Values) {
  const body = [
    `Name: ${values.name.trim()}`,
    `Email: ${values.email.trim()}`,
    values.phone.trim() ? `Phone: ${values.phone.trim()}` : null,
    "",
    values.message.trim(),
  ]
    .filter((line) => line !== null)
    .join("\n");
  const subject = `${values.subject} - Website enquiry`;
  return `mailto:${siteConfig.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ContactForm() {
  const formId = useId();
  const [values, setValues] = useState<Values>(emptyValues);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const statusRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Partial<Record<Field, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>>({});

  const errors = validate(values);
  const visibleError = (field: Field) => (attempted || touched[field] ? errors[field] : undefined);
  const errorCount = Object.keys(errors).length;
  const endpoint = siteConfig.contactForm.endpoint;

  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const onBlur = (field: Field) => setTouched((current) => ({ ...current, [field]: true }));

  const showStatus = (next: Status) => {
    setStatus(next);
    // Move focus to the result so screen reader and keyboard users notice it
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);

    if (errorCount > 0) {
      const firstInvalid = fieldOrder.find((field) => errors[field]);
      if (firstInvalid) fieldRefs.current[firstInvalid]?.focus();
      return;
    }

    if (!endpoint) {
      showStatus("not-configured");
      return;
    }

    setStatus("submitting");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          subject: values.subject,
          message: values.message.trim(),
        }),
      });
      showStatus(response.ok ? "sent" : "error");
    } catch {
      showStatus("error");
    }
  };

  const resetForm = () => {
    setValues(emptyValues);
    setTouched({});
    setAttempted(false);
    setStatus("idle");
  };

  const backToEditing = () => {
    setStatus("idle");
    requestAnimationFrame(() => fieldRefs.current.message?.focus());
  };

  if (status === "sent") {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 outline-none">
        <CheckCircle2 className="size-8 text-emerald-600" aria-hidden="true" />
        <h3 className="mt-4 text-xl font-semibold text-navy-900">Thank you, your enquiry has been sent</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We have received your message and will reply to {values.email.trim()}.
        </p>
        <button type="button" onClick={resetForm} className="mt-6 text-sm font-semibold text-brand-600 hover:text-brand-700">
          Send another enquiry
        </button>
      </div>
    );
  }

  if (status === "not-configured" || status === "error") {
    const isError = status === "error";
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        role={isError ? "alert" : "status"}
        className={`rounded-2xl border p-8 outline-none ${isError ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}
      >
        {isError ? (
          <AlertCircle className="size-8 text-red-600" aria-hidden="true" />
        ) : (
          <Info className="size-8 text-amber-600" aria-hidden="true" />
        )}
        <h3 className="mt-4 text-xl font-semibold text-navy-900">
          {isError ? "Your message could not be sent" : "Your message has not been sent yet"}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {isError
            ? "Something went wrong while sending your enquiry. Please try again, or send it to us by email instead."
            : "Online form submission is not available yet. Your details are complete. To reach us now, send your message by email using the button below; it will open in your email app with everything filled in."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={buildMailto(values)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <Mail className="size-4" aria-hidden="true" />
            Send by Email
          </a>
          <button
            type="button"
            onClick={backToEditing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-semibold text-navy-800 transition-colors hover:border-brand-500 hover:text-brand-600"
          >
            <Pencil className="size-4" aria-hidden="true" />
            Edit Message
          </button>
        </div>
        <p className="mt-5 text-xs text-subtle">
          Or email us directly at{" "}
          <a href={`mailto:${siteConfig.contact.email}`} className="font-medium text-brand-600 underline-offset-2 hover:underline">
            {siteConfig.contact.email}
          </a>
          .
        </p>
      </div>
    );
  }

  const submitting = status === "submitting";

  const inputClass = (field: Field) =>
    `block w-full rounded-xl border bg-white px-4 py-3 text-base text-ink shadow-sm transition-colors placeholder:text-subtle/70 focus:outline-none focus:ring-4 ${
      visibleError(field)
        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
        : "border-line focus:border-brand-500 focus:ring-brand-100"
    }`;

  const fieldProps = (field: Field) => ({
    id: `${formId}-${field}`,
    name: field,
    value: values[field],
    onChange,
    onBlur: () => onBlur(field),
    "aria-invalid": visibleError(field) ? true : undefined,
    "aria-describedby": visibleError(field) ? `${formId}-${field}-error` : undefined,
    disabled: submitting,
  });

  const errorText = (field: Field) =>
    visibleError(field) ? (
      <p id={`${formId}-${field}-error`} className="mt-2 flex items-start gap-1.5 text-sm text-red-600">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {visibleError(field)}
      </p>
    ) : null;

  const label = (field: Field, text: string, optional = false) => (
    <label htmlFor={`${formId}-${field}`} className="mb-2 block text-sm font-semibold text-navy-900">
      {text}
      {optional ? (
        <span className="ml-1 font-normal text-subtle">(optional)</span>
      ) : (
        <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
      )}
    </label>
  );

  return (
    <form noValidate onSubmit={onSubmit} aria-describedby={`${formId}-note`}>
      <p id={`${formId}-note`} className="mb-6 text-sm text-subtle">
        Fields marked <span className="text-red-500">*</span> are required.
      </p>

      {attempted && errorCount > 0 && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Please correct {errorCount === 1 ? "the highlighted field" : `the ${errorCount} highlighted fields`} below.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          {label("name", "Full name")}
          <input
            {...fieldProps("name")}
            ref={(el) => {
              fieldRefs.current.name = el;
            }}
            type="text"
            autoComplete="name"
            required
            className={inputClass("name")}
          />
          {errorText("name")}
        </div>

        <div>
          {label("email", "Email address")}
          <input
            {...fieldProps("email")}
            ref={(el) => {
              fieldRefs.current.email = el;
            }}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className={inputClass("email")}
          />
          {errorText("email")}
        </div>

        <div>
          {label("phone", "Phone number", true)}
          <input
            {...fieldProps("phone")}
            ref={(el) => {
              fieldRefs.current.phone = el;
            }}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            className={inputClass("phone")}
          />
          {errorText("phone")}
        </div>

        <div>
          {label("subject", "Subject")}
          <div className="relative">
            <select
              {...fieldProps("subject")}
              ref={(el) => {
                fieldRefs.current.subject = el;
              }}
              required
              className={`${inputClass("subject")} appearance-none pr-11 ${values.subject ? "" : "text-subtle"}`}
            >
              <option value="" disabled>
                Choose a subject
              </option>
              {subjects.map((subject) => (
                <option key={subject} value={subject} className="text-ink">
                  {subject}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          </div>
          {errorText("subject")}
        </div>

        <div className="sm:col-span-2">
          {label("message", "Message")}
          <textarea
            {...fieldProps("message")}
            ref={(el) => {
              fieldRefs.current.message = el;
            }}
            rows={6}
            required
            maxLength={MESSAGE_MAX + 200}
            className={`${inputClass("message")} resize-y`}
          />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">{errorText("message")}</div>
            <p className={`mt-2 shrink-0 text-xs ${values.message.trim().length > MESSAGE_MAX ? "text-red-600" : "text-subtle"}`}>
              {values.message.trim().length}/{MESSAGE_MAX}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex sm:justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-7 sm:w-auto text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgb(0_100_180/0.6)] transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden="true" />
              Send Enquiry
            </>
          )}
        </button>
      </div>
    </form>
  );
}
