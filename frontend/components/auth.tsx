import { Button } from "@/components/ui/button"
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AuthCard() {
    return (
        <Card className="w-full max-w-sm border shadow-lg">
            <CardHeader className="space-y-2 text-center">
                <CardTitle className="text-2xl font-semibold">
                    Welcome!
                </CardTitle>
                <CardDescription>
                    Sign in to start ordering
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
                <Button asChild className="w-full">
                    <a href="/auth/login">Log in</a>
                </Button>

                <Button asChild variant="outline" className="w-full">
                    <a href="/auth/login?screen_hint=signup">Create account</a>
                </Button>
            </CardContent>

        </Card>
    );
}

