var redisUtils = require('../util/redis-util'),
	goodUser = new RegExp("^[a-zA-Z0-9]{3,16}$"),
	client = redisUtils.createClient();

function pickFields(user) {
	if (!user) {
		return {};
	}
	return {
		username:      user.username,
		authenticated: true
	};
}

module.exports = function (api) {
	api.endpoint('user', {
		'url': '/user',
		'help': 'User management',

		'get': function getUser (req, res) {
			res.json(pickFields(req.user));
		},
		'delete': function logoutUser (req, res) {
			req.logout();
			res.json({});
		},
		'put': function createUsername (req, res) {
			var key;

			if (!req.isAuthenticated()) {
				return res.send(412, 'Not authenticated.');
			}

			// Check that they don't already have an account
			if (req.user.username) {
				return res.send(412, 'Already registered.');
			}

			// Test that username is valid
			if (!goodUser.test(req.query.username)) {
				return res.send(400, 'Invalid username.');
			}

			// Attempt to create the new username
			req.user.username = req.query.username;
			key = req.user.username.toLowerCase();
			req.session.passport.user = key;
			client.hsetnx(['users', key, JSON.stringify(req.user)], function (err, success) {
				if (err) {
					return res.send(500, 'Unknown error.');
				}

				if (!success) {
					return res.send(409, 'Username already exists.');
				}

				// Update the lookup key
				client.hset('users-id', req.user.id, key);
				client.hdel('users', req.user.id);

				return res.json(req.user);
			});
		}
	});
};