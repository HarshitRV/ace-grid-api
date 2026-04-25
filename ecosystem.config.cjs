module.exports = {
	apps: [
		{
			name: "acegridapi",
			script: "dist/app.js",
			cwd: "/home/harshitrvpi/code/pro/ace-grid-api",
			env_file: ".env.production",
			node_args: "--env-file=.env.production",
			instances: 1,
			exec_mode: "fork",
			watch: false,
			max_memory_restart: "200M",
			restart_delay: 5000,
			// Graceful shutdown
			kill_timeout: 5000,
			listen_timeout: 8000,
			// Logging
			error_file: "logs/pm2-error.log",
			out_file: "logs/pm2-out.log",
			merge_logs: true,
			log_date_format: "YYYY-MM-DD HH:mm:ss Z",
		},
	],
};
