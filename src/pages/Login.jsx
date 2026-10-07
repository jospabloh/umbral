import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AuthShell from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

const PRIVACY_URL = "https://acaciaco.com.mx/legal/privacidad";
const TERMS_URL = "https://acaciaco.com.mx/legal/terminos";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsOtp, setNeedsOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      const msg = err.message || "";
      if (/verify your email|verification code/i.test(msg)) {
        setNeedsOtp(true);
      } else {
        setError("Correo o contraseña incorrectos.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) base44.auth.setToken(result.access_token);
      window.location.href = returnTo;
    } catch (err) {
      setError("Código incorrecto. Vuelve a intentarlo.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await base44.auth.resendOtp(email);
    } catch (e) {}
  };

  const handleGoogle = () => base44.auth.loginWithProvider("google", returnTo);

  if (needsOtp) {
    return (
      <AuthShell>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Verifica tu correo</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enviamos un código a <span className="font-medium text-foreground">{email}</span>.
          </p>
        </div>
        {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <div className="mb-6 flex justify-center">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</> : "Entrar"}
        </Button>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button onClick={handleResend} className="text-primary hover:underline">Reenviar código</button>
          <button onClick={() => setNeedsOtp(false)} className="text-muted-foreground hover:underline">Volver</button>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Correo equivocado?{" "}
          <Link to="/register" className="text-primary hover:underline">Crea la cuenta con el correo correcto</Link>.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenido de nuevo</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Inicia sesión para administrar tu condominio.</p>
      </div>

      <Button variant="outline" className="mb-5 h-12 w-full" onClick={handleGoogle}>
        <GoogleIcon className="mr-2 h-5 w-5" /> Continuar con Google
      </Button>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">o</span></div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <Button type="submit" className="h-12 w-full" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</> : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link to="/register" className="text-primary font-medium hover:underline">Crear una</Link>
      </p>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">Términos</a>
        {" · "}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">Aviso de Privacidad</a>
        {" · "}
        <Link to="/soporte" className="hover:underline">Soporte</Link>
      </p>
    </AuthShell>
  );
}