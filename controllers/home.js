var logger     = require('log4js').getLogger("INDEX"),
    async      = require('async'),
    request    = require('request'),
    Blogs      = require('../models/Blogs'),
    Users      = require('../models/Users'),
    Provinces  = require('../models/Provinces'),
    Categories = require('../models/Categories'),
    Comments   = require('../models/Comments'),
    Likes      = require('likewed-models').Likes,
    config     = require('../config/config');

exports.login = function(req, res, next) {
	var referer = req.headers['referer'];

	if (referer && referer.length > 20)
		res.redirect(config.login_url+'?next='+referer);
	else 
		res.redirect(config.login_url+'?next=http://'+config.host+'/');
};

exports.logout = function(req, res) {
    if (req.loginUser && req.loginUser.no) {
        logger.info('user['+req.loginUser.no+'] logout...');
    }
    
    res.clearCookie('ld_userno', {domain: config.domain});
    res.redirect('/');
};

exports.category = function(req, res, next, name){
	Categories.categoryByName(name, function(err, category){
		if (err) {
		  next(err);
		} else if (category) {
		  req.category = category;
		  res.locals.category = category;
		  next();
		} else {
		  next(new Error('failed to load category'));
		}
	});
};

exports.city = function(req, res, next, city){
	var items = city.split('_');

	if (items.length !== 2) {
		next(new Error('arguments foramt error'));
	} else {
		logger.info('province:'+items[0]+", city:"+items[1]);
		Provinces.locationById(parseInt(items[0]), parseInt(items[1]), function(err, location){
			logger.debug('location:', location);
			req.location = location;
		  	res.locals.location = location;
			next();
		});
	}
};

function _index_data(query, page, size, hot, callback) {
	async.parallel({
		posts: function(callback) {
			Blogs.posts(query, page, size, hot, callback)
		},
		recommands: function(callback) {
			Blogs.recommands(query, callback);
		},
		hot_tags: function(callback) {
			Blogs.hot_tags(callback);
		},
		lasted_posts: function(callback) {
			Blogs.posts(query, 1, config.lasted_size, 0, callback);
		},
		hot_posts: function(callback) {
			Blogs.posts(query, 1, config.hot_size, config.hot, callback);
		},
		lasted_total: function(callback) {
			Blogs.count(query, 0, function(err, count){
				if (err) return callback(err);

				callback(null, parseInt((count+config.lasted_size-1)/config.lasted_size));
			});
		},
		hot_total: function(callback) {
			Blogs.count(query, config.hot, function(err, count){
				if (err) return callback(err);

				callback(null, parseInt((count+config.popular_size-1)/config.popular_size));
			});
		},
		total: function(callback) {
			Blogs.count(query, hot, function(err, count){
				if (err) return callback(err);

				callback(null, parseInt((count+config.popular_size-1)/config.popular_size));
			});
		}
	}, callback);	
}

exports.index = function(req, res, next) {
	//对旧的wordpress博客链接访问进行重定向
	var postno = parseInt(req.param('p',  0));
	if (postno > 0) {
		return res.redirect(301, 'http://blog.likewed.com/post/'+(postno+180000));
	}

	var page = parseInt(req.param('page', 1));
	_index_data({}, page, config.popular_size, config.popular, function(err, result){
		if (err) return next(err);

		result.page = page;
		logger.debug('page:', result.page);
		logger.debug('total:', result.total);
		res.render('index', result);
	});	
};

exports.index4archive = function(req, res, next) {
	var page = parseInt(req.param('page', 1));

	var query = {};
	async.parallel({
		posts: function(callback) {
			Blogs.posts(query, page, config.archive_size, 0, callback)
		},
		hot_tags: function(callback) {
			Blogs.hot_tags(callback);
		},
		lasted_posts: function(callback) {
			Blogs.posts(query, 1, config.lasted_size, 0, callback);
		},
		hot_posts: function(callback) {
			Blogs.posts(query, 1, config.hot_size, config.hot, callback);
		},
		lasted_total: function(callback) {
			Blogs.count(query, 0, function(err, count){
				if (err) return callback(err);

				callback(null, parseInt((count+config.lasted_size-1)/config.lasted_size));
			});
		},
		hot_total: function(callback) {
			Blogs.count(query, config.hot, function(err, count){
				if (err) return callback(err);

				callback(null, parseInt((count+config.popular_size-1)/config.popular_size));
			});
		},total: function(callback) {
			Blogs.count(query, 0, function(err, count){
				if (err) return callback(err);

				callback(null, parseInt((count+config.archive_size-1)/config.archive_size));
			});
		}
	}, function(err, result){
		if (err) return next(err);

		result.page = page;
		result.category = {name: 'articlelist'};
		res.render('archive', result);
	});	
};

exports.index4category = function(req, res, next) {
	var page = parseInt(req.param('page', 1));

	var query = {category: req.category.no};
	_index_data(query, page, config.popular_size, config.popular, function(err, result){
		if (err) return next(err);

		result.page = page;
		res.render('category', result);
	});	
};

exports.index4city = function(req, res, next) {
	var page = parseInt(req.param('page', 1));
	var location = req.location;

	var query = {};
	if (location.province > 0) query['user.province'] = location.province;
	if (location.city > 0 && location.city !== 1000) query['user.city'] = location.city;
	query['user.type'] = {'$in':[1, 3,4,5]};

	_index_data(query, page, config.popular_size, config.popular, function(err, result){
		if (err) return next(err);

		result.page = page;
		res.render('city', result);
	});	
};

exports.index4tag = function(req, res, next) {
	var page = parseInt(req.param('page', 1));
	var tag  = req.params.tag;

	var query = {tags: tag};
	_index_data(query, page, config.popular_size, config.popular, function(err, result){
		if (err) return next(err);

		result.page = page;
		result.tag  = tag;

		res.render('tag', result);
	});	
};

exports.blog = function(req, res, next) {
	var postno = parseInt(req.params.postno);

	Blogs.blog(postno, function(err, blog) {
		if (err) return next(err);

		if (!blog) return next(new Error('not found'));

		var query = { category: blog.category.no};
		async.parallel({
			recommands: function(callback) {
				Blogs.recommands(query, callback);
			},
			hot_tags: function(callback) {
				Blogs.hot_tags(callback);
			},
			lasted_posts: function(callback) {
				Blogs.posts(query, 1, config.lasted_size, 0, callback);
			},
			hot_posts: function(callback) {
				Blogs.posts(query, 1, config.hot_size, config.hot, callback);
			},
			relation_posts: function(callback) {
				Blogs.relations(blog, callback);
			},
			owner: function(callback) {
				Users.get(blog.user._id, callback);
			},
			previous: function(callback) {
				Blogs.blog_previous(blog._id, callback);
			},
			lasted_total: function(callback) {
				Blogs.count(query, 0, function(err, count){
					if (err) return callback(err);

					callback(null, parseInt((count+config.lasted_size-1)/config.lasted_size));
				});
			},
			hot_total: function(callback) {
				Blogs.count(query, config.hot, function(err, count){
					if (err) return callback(err);

					callback(null, parseInt((count+config.popular_size-1)/config.popular_size));
				});
			},
				next: function(callback) {
				Blogs.blog_next(blog._id, callback);
			},
			comments: function(callback) {
				Comments.commentsByPostId(blog._id, callback);
			},
			isLiked: function(callback) {
				if (req.loginUser) {
					Likes.postIsLiked(req.loginUser._id, blog._id, callback);
				} else {
					callback(null, false);
				}
			}
		}, function(err, result){
			if (err) return next(err);

			result.blog = blog;
			result.category = blog.category;
			res.render('blog', result);	
		});	
	});
};

function _loadMore(query, page, size, hot, callback) {
	async.parallel({
		posts: function(callback) {
			Blogs.posts(query, page, size, hot, callback)
		},
		total: function(callback) {
			Blogs.count(query, hot, function(err, count){
				if (err) return callback(err);

				callback(null, parseInt((count+size-1)/size));
			});
		}
	}, callback);
}

exports.lasted = function(req, res, next) {
	var page = parseInt(req.param('page', 1));

	_loadMore({}, page, config.lasted_size, 0, function(err, result){
		if (err) return next(err);

		result.page = page + 1;
		result.path = req.path;
		result.type = "new"
		res.render('loadmore', result);
	});	
};

exports.hot = function(req, res, next) {
	var page = parseInt(req.param('page', 1));

	_loadMore({}, page, config.hot_size, config.hot, function(err, result){
		if (err) return next(err);

		result.page = page + 1;
		result.path = req.path;
		result.type = "hot"
		res.render('loadmore', result);
	});	
};

exports.lasted4Category = function(req, res, next) {
	var page = parseInt(req.param('page', 1));
	var category = req.category;

	_loadMore({category: category.no}, page, config.lasted_size, 0, function(err, result){
		if (err) return next(err);

		result.page = page + 1;
		result.path = req.path;
		res.render('loadmore', result);
	});	
};

exports.hot4Category = function(req, res, next) {
	var page = parseInt(req.param('page', 1));
	var category = req.category;

	_loadMore({category: category.no}, page, config.hot_size, config.hot, function(err, result){
		if (err) return next(err);

		result.page = page + 1;
		result.path = req.path;
		res.render('loadmore', result);
	});	
};

exports.lasted4City = function(req, res, next) {
	var page = parseInt(req.param('page', 1));
	var location = req.location;

	var query = {};
	if (location.province > 0) query['user.province'] = location.province;
	if (location.city > 0 && location.city !== 1000) query['user.city'] = location.city;
	query['user.type'] = {'$in':[1, 3,4,5]};

	_loadMore(query, page, config.lasted_size, 0, function(err, result){
		if (err) return next(err);

		result.page = page + 1;
		result.path = req.path;
		res.render('loadmore', result);
	});	
};

exports.hot4City = function(req, res, next) {
		var page = parseInt(req.param('page', 1));
	var location = req.location;

	var query = {};
	if (location.province > 0) query['user.province'] = location.province;
	if (location.city > 0 && location.city !== 1000) query['user.city'] = location.city;
	query['user.type'] = {'$in':[1, 3,4,5]};
	
	_loadMore(query, page, config.hot_size, config.hot, function(err, result){
		if (err) return next(err);

		result.page = page + 1;
		result.path = req.path;
		res.render('loadmore', result);
	});	
};

exports.lasted4Tag = function(req, res, next) {
	var page = parseInt(req.param('page', 1));
	var tag  = req.params.tag;

	_loadMore({tags: tag}, page, config.lasted_size, 0, function(err, result){
		if (err) return next(err);

		result.page = page + 1;
		result.path = req.path;
		res.render('loadmore', result);
	});	
};

exports.hot4Tag = function(req, res, next) {
	var page = parseInt(req.param('page', 1));
	var tag  = req.params.tag;

	_loadMore({tags: tag}, page, config.hot_size, config.hot, function(err, result){
		if (err) return next(err);

		result.page = page + 1;
		result.path = req.path;
		res.render('loadmore', result);
	});	
};

function _sphinx_posts_search(term, offset, limit, callback){
    logger.info('search term['+term+'], offset['+offset+'], limit['+limit+'].');
    request({
            url: config.search_url+'?q='+term+'&offset='+offset+'&limit='+limit,
            json: true
        },
        function(err, response, body){
            if (err || response.statusCode !== 200) {
                logger.error('search ['+term+'] failed. response.statusCode['+response.statusCode+'], error['+err+'].');
                return callback(new Error('search error.'));
            }

            callback(null, body);
        }
    );
};

function _posts_search(term, offset, limit, callback){
	_sphinx_posts_search(term, offset, limit, function(err, result){
        if (err) return callback(err);

        if (!result || !result.matches) {
            logger.warn('not match record for term['+term+'].');
            return callback(null, {total: 0, posts:[]});
        }

        async.map(result.matches, function(item, callback){
            Blogs.get4List(item.id, callback);
        }, function(err, results){
        	if (err) return callback(err);

        	var posts = [];
            for(var i = 0, len = results.length; i < len; i++) {
                if (results[i]) posts.push(results[i]);
            }

            callback(null, {total: parseInt(result.total), posts: posts});
        });
    });
};

exports.search = function(req, res, next) {
	var page = parseInt(req.param('page', 1));
	var term = req.param("term", "").trim();

	var query = {};
	async.parallel({
		search: function(callback) {
			if (term.length <= 0) {
				callback(null, {posts:[], total: 0});
			} else {
				_posts_search(term, (page-1)*config.popular_size, config.popular_size, callback);
			}
		},
		hot_tags: function(callback) {
			Blogs.hot_tags(callback);
		},
		lasted_posts: function(callback) {
			Blogs.posts(query, 1, config.lasted_size, 0, callback);
		},
		hot_posts: function(callback) {
			Blogs.posts(query, 1, config.hot_size, config.hot, callback);
		},
		lasted_total: function(callback) {
			Blogs.count(query, 0, function(err, count){
				if (err) return callback(err);

				callback(null, parseInt((count+config.lasted_size-1)/config.lasted_size));
			});
		},
		hot_total: function(callback) {
			Blogs.count(query, config.hot, function(err, count){
				if (err) return callback(err);

				callback(null, parseInt((count+config.popular_size-1)/config.popular_size));
			});
		}
	}, function(err, result){
		if (err) return next(err);

		result.page = page;
		result.posts = result.search.posts;
		result.total = parseInt((result.search.total+config.popular_size-1)/config.popular_size);
		result.term = term;
		
		res.render('search', result);
	});	
};

//用于生成长微博
exports.changWeibo = function(req, res, next) {
	var postno = parseInt(req.params.postno);

	Blogs.blog(postno, function(err, blog) {
		if (err) return next(err);

		if (!blog) return next(new Error('not found'));

		Users.get(blog.user._id, function(err, user){
			if (err) return next(err);

			blog.user = user;
			res.render('changweibo', {owner: user, blog: blog});	
		});
	});
};
