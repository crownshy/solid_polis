import { Session, type ISessionInfo } from "@inrupt/solid-client-authn-browser";

class SolidSession {
	solidSession = new Session();
	session: Session | undefined = $state();
	info: ISessionInfo | undefined = $state()
	isLoggedIn: boolean = $state(false)
	sessionId: string | undefined = $state()
	webId: string | undefined = $state()

	constructor() {
		this.solidSession.events.on("login", this.updateSession)
		this.solidSession.events.on("logout", this.updateSession)
	}

	updateSession() {
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
		await this.solidSession.login({
			oidcIssuer: issuer,
			redirectUrl: window.location.href,
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
	console.log("running handle redirect after login")
	let sessionInfo = await SSession.solidSession.handleIncomingRedirect({ url: window.location.href, restorePreviousSession: true });
	console.log(sessionInfo)
	console.log(SSession.solidSession)
	setTimeout(() => {
		SSession.updateSession()
		if (SSession.isLoggedIn) {
			console.log("Logged in as", SSession.webId);
		}
	})
}

export { SSession as session };
