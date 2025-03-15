import { clearCredentials } from "@/lib/stronghold";
import { Button } from "../ui/button"
import { useViewStore, View } from "@/stores/viewStore";

export default function SignOutButton() {
    const viewStore = useViewStore((state) => state);
    const signOut = async () => {
        try {
            await clearCredentials();
            viewStore.setView(View.LOGIN);
        } catch (error) {
            console.error("Error clearing token from Stronghold:", error);
            viewStore.setView(View.LOGIN);
        }
    }
    
    return (
        <Button onClick={signOut}>
            <span>Sign Out</span>
        </Button>
    )
}
