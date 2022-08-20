module.exports = {
	root: true,
	env: {
		es6: true,
		node: true
	},
	extends: "standard",
	parser: "@typescript-eslint/parser",
	parserOptions: {
		project: ["tsconfig.json", "tsconfig.dev.json"],
		sourceType: "module"
	},
	ignorePatterns: [
		"/lib/**/*" // Ignore built files.
	],
	plugins: ["@typescript-eslint", "import"],
	rules: {
		quotes: ["error", "double"],
		indent: [1, "tab"],
		"space-before-function-paren": 0,
		"no-tabs": 0,
		"import/no-unresolved": 0
	}
}
