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
        <Card className="w-full max-w-sm">
            <Button type="submit" className="w-full">
                Login
            </Button>
            <Button variant="outline" className="w-full">
                <a href="/auth/login?screen_hint=signup">Sign up</a>
            </Button>
        </Card>
    )
}
