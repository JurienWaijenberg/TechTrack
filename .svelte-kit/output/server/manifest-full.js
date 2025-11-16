export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["robots.txt"]),
	mimeTypes: {".txt":"text/plain"},
	_: {
		client: {start:"_app/immutable/entry/start.DWNsprub.js",app:"_app/immutable/entry/app.BiRH11fN.js",imports:["_app/immutable/entry/start.DWNsprub.js","_app/immutable/chunks/Jy-jRyzV.js","_app/immutable/chunks/DpkMm3R6.js","_app/immutable/chunks/CvA15Wsb.js","_app/immutable/entry/app.BiRH11fN.js","_app/immutable/chunks/DpkMm3R6.js","_app/immutable/chunks/DqzjzzG8.js","_app/immutable/chunks/DK0t8MAW.js","_app/immutable/chunks/CvA15Wsb.js","_app/immutable/chunks/RrAb_RiY.js","_app/immutable/chunks/DCtXfeol.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
