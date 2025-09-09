import multiprocessing
import os

# Server Socket
# Bind to 0.0.0.0 to listen on all available network interfaces.
# The port is dynamically set by Render via the PORT environment variable.
bind = f"0.0.0.0:{os.environ.get('PORT', 5000)}"


# Worker Processes
# A good starting point is (2 x number of CPUs) + 1.
# This dynamically adjusts to the server's resources.
workers = multiprocessing.cpu_count() * 2 + 1
threads = 2


# The type of worker that Gunicorn will use.
# 'gthread' is a good choice for standard I/O-bound Flask apps.
worker_class = 'gthread'


# Worker Timeout
# If a worker does not respond within this time (in seconds), it's killed and restarted.
timeout = 120


# Logging
# Log to stdout ('-') so that platforms like Render can capture and display the logs.
accesslog = '-'
errorlog = '-'
loglevel = 'info'