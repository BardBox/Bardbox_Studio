import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SetPasswordForm } from '@/components/auth/SetPasswordForm';

export default function SetPasswordPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Welcome to ContentOps</CardTitle>
        <CardDescription>Set a password to secure your account</CardDescription>
      </CardHeader>
      <CardContent>
        <SetPasswordForm />
      </CardContent>
    </Card>
  );
}
