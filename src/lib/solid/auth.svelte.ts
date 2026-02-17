import { goto } from "$app/navigation";
import { Session, type ISessionInfo } from "@inrupt/solid-client-authn-browser";

class SolidSession {
	solidSession = new Session();
	session: Session | undefined = $state();
	info: ISessionInfo | undefined = $state()
	isLoggedIn: boolean = $state(false)
	sessionId: string | undefined = $state()
	webId: string | undefined = $state()
	isRestoringSession: boolean = $state(true) // Start as true to prevent flash

	constructor() {
		this.solidSession.events.on("login", () => this.updateSession())
		this.solidSession.events.on("logout", () => this.updateSession())
		this.solidSession.events.on("sessionRestore", () => this.updateSession())
	}

	updateSession = () => {
		if (this.solidSession === undefined) {
			this.session = undefined
			this.info = undefined
			this.isLoggedIn = false
			this.webId = undefined
			this.sessionId = undefined
		}
		else {
			this.session = this.solidSession
			this.info = this.solidSession.info
			this.isLoggedIn = this.solidSession.info.isLoggedIn
			if (this.solidSession.info.isLoggedIn) {
				this.webId = this.solidSession.info.webId
				this.sessionId = this.solidSession.info.sessionId
			}
		}
	}

	/**
	 * Get the authenticated fetch function
	 * This fetch includes the user's authentication credentials
	 */
	getFetch(): typeof fetch {
		return this.solidSession.fetch.bind(this.solidSession);
	}

	async login(issuer: string) {
		// Store current URL to return to after OAuth completes
		const currentPath = window.location.pathname + window.location.search;
		if (currentPath !== '/') {
			sessionStorage.setItem('solid-polis-post-login-path', currentPath);
		}

		await this.solidSession.login({
			oidcIssuer: issuer,
			redirectUrl: window.location.origin,
			clientName: "Polis-Solid Svelte App"
		});
		this.updateSession();
	}

	async logout() {
		await this.solidSession.logout();

	}
}

const SSession = new SolidSession();


export async function handleRedirectAfterLogin() {
	console.log("=== handleRedirectAfterLogin START ===");
	console.log("Current URL:", window.location.href);
	SSession.isRestoringSession = true;

	try {
		// Check if this is an OAuth callback (has code/state in URL)
		const urlParams = new URLSearchParams(window.location.search);
		const isOAuthCallback = urlParams.has('code') && urlParams.has('state');
		console.log("Is OAuth callback?", isOAuthCallback);

		const sessionInfo = await SSession.solidSession.handleIncomingRedirect({
			restorePreviousSession: true
		});

		if (sessionInfo?.isLoggedIn) {
			console.log("Session restored! Logged in as:", sessionInfo.webId);

			// Only redirect to stored path after fresh OAuth login, not on regular session restore
			if (isOAuthCallback) {
				const postLoginPath = sessionStorage.getItem('solid-polis-post-login-path');
				const currentPath = window.location.pathname + window.location.search;
				console.log("Stored path:", postLoginPath);
				console.log("Current path:", currentPath);

				// Only redirect if the stored path is different from current location
				if (postLoginPath && postLoginPath !== currentPath && !currentPath.includes('code=')) {
					console.log(">>> REDIRECTING to stored path:", postLoginPath);
					sessionStorage.removeItem('solid-polis-post-login-path');
					goto(postLoginPath)
					// window.location.href = postLoginPath;
					return;
				} else {
					console.log("Not redirecting - clearing stored path");
					sessionStorage.removeItem('solid-polis-post-login-path');
				}
			}
		} else {
			console.log("No previous session found");
		}

		// Update the reactive session state
		SSession.updateSession();
		console.log("=== handleRedirectAfterLogin END ===");
	} catch (error) {
		console.error("Error restoring session:", error);
	} finally {
		SSession.isRestoringSession = false;
	}
}

export { SSession as session };
