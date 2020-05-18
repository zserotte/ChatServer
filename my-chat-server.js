// Require the packages we will use:
var http = require("http"),
	// We can use the socket.io stuff (Socket.io is a function that requires parameters when you use it) through our 
	// socketio variable
	socketio = require("socket.io"),
	fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	
	  switch (req.url) {
		case "/my-client.css" :
		  fs.readFile("my-client.css", function(err, data){
		  // This callback runs when the client.css file has been read from the filesystem.
		  if(err) return resp.writeHead(500);
		  resp.writeHead(200, {'Content-Type': 'text/css'});
		  resp.end(data);
		});
		break;
		default :
		  fs.readFile("my-client.html", function(err, data){
		  // This callback runs when the client.html file has been read from the filesystem.
		  if(err) return resp.writeHead(500);
		  resp.writeHead(200);
		  resp.end(data);
		});
	  }
	});
	app.listen(3456);
// Class with objects that contain each username and the correspoinding room that they are currently in
class User {
	constructor(username, chat_room) {
		this.username = username;
		this.chat_room = chat_room;
	}
}

// Class with objects that contain each room and the admin of the corresponding admin
class chatRoom {
	constructor(roomName, admin) {
		this.roomName = roomName;
		this.admin = admin;
	}
}

// class with each room and its associated password
class password {
	constructor(room, password) {
		this.room = room;
		this.password = password;
	}
}

// Class with objects that have each users username and their computer generated alias username
class alias {
	constructor(username, alias) {
		this.username = username;
		this.alias = alias;
	}
}

// Class with objects that have the banned users username and the room that they are banned form
class ban {
	constructor(username, chat_room) {
		this.username = username;
		this.chat_room = chat_room;
	}
}

// Sets up sockets on the server side. Socket.io is sitting around on server waiting for a connection     
var io = socketio.listen(app);

// Array of User objects
var rooms = [];
// Array of chatRoom objects 
var admins = [];
// Array to store the socket for each user
var connectedUsers = {};
// Array of alias objects 
var aliases = [];
// Array of password objects
var passwords = [];
// Array of ban objects
var banned = [];

// Once a connection event has been made with a specific browser (We make the connection on the client, front side), 
// socket variable refers to the instance of the socket between the client thats making the connection and the server
io.sockets.on("connection", function(socket){
	// Connection is setup on backend now

	// when the client calls add user, this executes
	socket.on('adduser', function(data){

		var currentUser;
		var indicator = false;
		for (i = 0; i < rooms.length; i++) {
			currentUser = rooms[i];
			if(currentUser.username==data.username){
				indicator = true;
			}
		}
		if(indicator){
			socket.emit("nameTaken");
			return;
		}
		else{
			socket.leaveAll();
			// Join the general room
			socket.join("general");
			// Update the list of vailable rooms for the user that just logged in
			io.sockets.connected[socket.id].emit("update_rooms_log", {list: admins, passwords: passwords});
			var subscribed = data["subscribed"];
			socket.emit("showHTML", {subscribed:subscribed});
			// Set the nickname for the socket to be their username
			socket.nickname = data.username;
			// Store the socket of each user
			connectedUsers[data.username] = socket;
			var obj = Object.keys(socket.rooms);
			// set the room that the user is currently in
			socket.currently = "general";
			var newUser = new User(data.username, "general");
			rooms.push(newUser);
			var newAlias = new alias (data.username, data.username + "1");
			aliases.push(newAlias);
			// Update the list of users in the room
			socket.to(socket.currently).emit("add_me", {me:data.username});
			socket.emit("im_new", {list:rooms});
			// We were using the users username as the id of 2 different elements in our html page. By adding a '1' to the users
			// username in this scenario, we now have the ability to individually refer to the different elements on the client side
			socket.to(socket.currently).emit("add_private", {me:data.username + "1"});
			socket.emit("room_members", {others:rooms});
			// Update the pane that displays what your username
			socket.emit("update_username_display", {me:data.username});
		}
	});

	// All the functionallity for when a user creates a new public room
	socket.on('add_room', function(data) {
		var indicator = false;
		var currentRoom;
		for (i = 0; i < admins.length; i++) {
			currentRoom = admins[i];
			if (currentRoom.roomName == data["theRoom"]) {
				indicator = true;
			}
		}
		// If the room name they wanted to create was already taken
		if (indicator) {
			socket.emit("roomTaken");
			return;
		}
		else {
			socket.emit("update_chatlog");
			var leaving = socket.currently;
			socket.leaveAll();
			socket.join(data["theRoom"]);
			socket.currently = data["theRoom"];
			var pushedRoom = new chatRoom(data["theRoom"], socket.nickname);
			admins.push(pushedRoom);
			var currentUser;
			for (i = 0; i < rooms.length; i++) {
				currentUser = rooms[i];
				// Update the room that the user is in in our array
				if(currentUser.username==pushedRoom.admin){
					currentUser.chat_room = pushedRoom.roomName;
				}
			}

			// Send the room back to the client side and update the html so that other users can join it
			io.sockets.emit("update_rooms", {name:data["theRoom"]});
			// Update the users in the room that the user just left
			socket.to(leaving).emit("remove_me", {me:socket.nickname});
			socket.emit("new_room", {me:socket.nickname});
			// Update the users that you can send private messages to in the room the user just left
			socket.to(leaving).emit("remove_private", {me:socket.nickname + "1"});
			socket.emit("new_private", {me:socket.nickname + "1"});
			// Update the pane that displays what room you are in
			socket.emit("update_room_display", {room:socket.currently});
			// Give them admin powers for the room that they created
			socket.emit("display_admin_powers");
		}
	})

	// All the functionallity for when a user creates a new private room
	socket.on('add_private_room', function(data) {
		var indicator = false;
		var currentRoom;
		for (i = 0; i < admins.length; i++) {
			currentRoom = admins[i];
			if (currentRoom.roomName == data["theRoom"]) {
				indicator = true;
			}
		}
		// The room name was taken
		if (indicator) {
			socket.emit("roomTaken");
			return;
		}
		// The room name was free and we can create it
		else {
			socket.emit("update_chatlog");
			var leaving = socket.currently;
			socket.leaveAll();
			socket.join(data["theRoom"]);
			socket.currently = data["theRoom"];
			var pushedRoom = new password(data["theRoom"], data["password"]);
			passwords.push(pushedRoom);
			pushedRoom = new chatRoom(data["theRoom"], socket.nickname);
			admins.push(pushedRoom);
			
			// Change the room that that user is associated with in our rooms array
			var currentUser;
			for (i = 0; i < rooms.length; i++) {
				currentUser = rooms[i];
				if(currentUser.username==socket.nickname){
					currentUser.chat_room = data["theRoom"];
				}
			}

			// Send the room back to the client side and update the html so that other users can join it
			io.sockets.emit("update_private_rooms", {name:data["theRoom"]});
			socket.to(leaving).emit("remove_me", {me:socket.nickname});
			socket.emit("new_room", {me:socket.nickname});
			socket.to(leaving).emit("remove_private", {me:socket.nickname + "1"});
			socket.emit("new_private", {me:socket.nickname + "1"});
			socket.emit("update_room_display", {room:socket.currently});
			socket.emit("display_admin_powers");
		}
	});

	// All the functionallity for when a user joins a private room
	socket.on('join_private_room', function(data) {
		// Room now stores the room that the user wants to join
		var room = data["newRoom"]
		var answer = data["answer"];
		var entry = 1;
		// Make sure the user is not banned from the room
		for (i = 0; i < banned.length; i++) {
			if ( (banned[i].username == socket.nickname) && (banned[i].chat_room == room) ) {
				entry = 0;
			}
		}
		// The user was banned from the room he was trying to enter
		if (entry == 0) {
			socket.emit("attempted_banned_entry");
		}
		else {
			var allowed = 0;
			var currentRoom;
			// Iterate through our array of passwords and see if they enetered the right password for the chat room
			for (i = 0; i < passwords.length; i++) {
				currentRoom = passwords[i];
				if (currentRoom.room == room) {
					// Compare their answer to the password for the room they want to join
					if(currentRoom.password == answer) {
						allowed = 1;
					}
				}
			}
			// They entered the wrong password for that room
			if (allowed == 0) {
				socket.emit("wrong-password");
			}
			// They made it past password validation
			else {
				var leaving = socket.currently;
				socket.leaveAll();
				socket.emit("update_chatlog");
				socket.join(data["newRoom"]);
				socket.currently = data["newRoom"];
				var currentUser;
				for (i = 0; i < rooms.length; i++) {
					currentUser = rooms[i];
					if(currentUser.username==socket.nickname){
						currentUser.chat_room = data["newRoom"];
					}
				}
			
				socket.to(leaving).emit("remove_me", {me:socket.nickname});
				socket.to(socket.currently).emit("add_me", {me:socket.nickname});
				socket.emit("joining_room", {list:rooms, mine:socket.currently});
				socket.to(leaving).emit("remove_private", {me:socket.nickname + "1"});
				socket.to(socket.currently).emit("update_private_add", {me:socket.nickname + "1"});
				socket.emit("update_private_me", {list:rooms, mine:socket.currently});
				socket.emit("update_room_display", {room:socket.currently});
				// Take away their admin powers
				socket.emit("hide_admin_powers");
			}
		}
	});

	// All the functionallity for when a user joins a public room
	socket.on('join_room', function(data) {
		var room = data["newRoom"];
		var entry = 1;
		// Make sure the user is not banned from the room
		for (i = 0; i < banned.length; i++) {
			if ( (banned[i].username == socket.nickname) && (banned[i].chat_room == room) ) {
				entry = 0;
			}
		}
		// The user was banned from the room he was trying to enter
		if (entry == 0) {
			socket.emit("attempted_banned_entry");
		}
		else {
			var leaving = socket.currently;
			socket.leaveAll();
			socket.emit("update_chatlog");
			socket.join(data["newRoom"]);
			socket.currently = data["newRoom"];
			var currentUser;
			for (i = 0; i < rooms.length; i++) {
				currentUser = rooms[i];
				if(currentUser.username==socket.nickname){
					currentUser.chat_room = data["newRoom"];
				}
			}

			socket.to(leaving).emit("remove_me", {me:socket.nickname});
			socket.to(socket.currently).emit("add_me", {me:socket.nickname});
			socket.emit("joining_room", {list:rooms, mine:socket.currently});
			socket.to(leaving).emit("remove_private", {me:socket.nickname + "1"});
			socket.to(socket.currently).emit("update_private_add", {me:socket.nickname + "1"});
			socket.emit("update_private_me", {list:rooms, mine:socket.currently});
			socket.emit("update_room_display", {room:socket.currently});
			socket.emit("hide_admin_powers");
		}
	});

	socket.on('private_message', function(data) {
		// Emit the message to the socket of the correct user
		connectedUsers[data["to"]].emit("private_message_to_client",{message:data["content"], person:data["from"]});
		// Emit the private message to yourself (The user that sent the private message), as well
		socket.emit("private_message_to_client",{message:data["content"], person:data["from"]});
	})
	
	socket.on('message_to_server', function(data) {
		// Get the correct room to send the message to
		var obj = Object.keys(socket.rooms);
		io.to(obj[0]).emit("message_to_client",{message:data["message"], person:data["person"], sensitive:data["age_limit"]})
	});

	// Kick a user back to the general room
	socket.on('kick_user', function(data) {
		// The room that the admin is in
		var my_room = socket.currently;
		// The username of the user you want to kick
		var user = data["user"];
		var successful_kick = 0;

		for (i = 0; i < rooms.length; i++) {
			// Make sure that the user the admin wants to kick is in the same room as the admin
			if ( (rooms[i].username == user) && (rooms[i].chat_room == my_room) ) {
				successful_kick = 1;
				socket_to_kick = connectedUsers[user];
				socket_to_kick.emit("back_to_general");
			}
		}
		// If the admin did not successfully kick the user, alert them
		if (successful_kick != 1) {
			socket.emit("failed_kick");
		}
	});

	socket.on('ban_user', function(data) {
		var my_room = socket.currently;
		var user = data["user"];
		var successful_kick = 0;

		for (i = 0; i < rooms.length; i++) {
			if ( (rooms[i].username == user) && (rooms[i].chat_room == my_room) ) {
				// Add the user to the list of permanently banned users
				var permanent_kick = new ban(user, socket.currently);
				banned.push(permanent_kick);
				successful_kick = 1;
				socket_to_kick = connectedUsers[user];
				socket_to_kick.emit("back_to_general");
			}
		}
		// If the admin did not successfully kick the user, alert them
		if (successful_kick != 1) {
			socket.emit("failed_ban");
		}

	})
});