/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

        http://aws.amazon.com/apache2.0/

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * - Web service: communicate with an external web service to get guest data from TVMaze API (api.tvmaze.com)
 *
 * Examples:
 * One-shot model:
 *  User:  "Alexa, ask Nocturnal Ninja who's going to be on The Late Show."
 *  Alexa: "Tonight, Stephen Colbert welcomes to the show ... ."
 * Dialog model:
 *  User:  "Alexa, open Nocturnal Ninja"
 *  Alexa: "Welcome to Nocturnal Ninja.  Your guide to who is going to be on the late night talk show. For which host or show would you like guest information?"
 *  User:  "Jimmy Fallon"
 *  Alexa: "Tonight, Jimmy Fallon welcomes to the show ... ."
 */

'use strict';

var AlexaSkill = require('./AlexaSkill'),
    showData = require('./data');

var APP_ID = 'amzn1.echo-sdk-ams.app.f3c3b651-1a73-4c64-bafe-1f7dd9a9ae28';

/**
 * NocturnalNinja is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var NocturnalNinja = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
NocturnalNinja.prototype = Object.create(AlexaSkill.prototype);
NocturnalNinja.prototype.constructor = NocturnalNinja;

NocturnalNinja.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
        var speechOutput = {
            speech: "<speak>Welcome to Nocturnal Ninja.  Your guide to who is going to be on the late night talk shows ... "
                + "For which host or show would you like guest information?</speak>",
            type: AlexaSkill.speechOutputType.SSML
        },
//        Offer help if user does not reply to initial question or says something not understood by Alexa
        repromptOutput = {
            speech: "For instructions on how to phrase your request, please say help me.",
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };

    response.ask(speechOutput, repromptOutput);
};

NocturnalNinja.prototype.intentHandlers = {
    "GuestListIntent": function (intent, session, response) {

        var inputSlot = intent.slots.Input,
            inputName;
        
        if (inputSlot && inputSlot.value) {
            inputName = inputSlot.value.toLowerCase();
        }
        
        if (inputName in showData) {
            getFinalGuestResponse(inputName, response);
        } else {
            var speechOutput,
                repromptOutput;
    
            speechOutput = {
                speech: "<speak>I'm sorry, I could not find information on that host or show.  Please try again.</speak>",
                type: AlexaSkill.speechOutputType.SSML
            };
            repromptOutput = {
                speech: "Please say something like ... who is going to be on Jimmy Fallon or who is going to be on the tonight show.  Or say cancel to quit.",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
            };
            response.ask(speechOutput, repromptOutput);
        }
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        var speechOutput = {
            speech: "<speak>You can find out what guests are going to be on the late night talk shows by saying something like, "
                + "Who is going to be on The Tonight Show?" + "Now, what show or host would you like guest information for?</speak>",
            type: AlexaSkill.speechOutputType.SSML
        },
//        Offer help if user does not reply to initial question or says something not understood by Alexa
        repromptOutput = {
            speech: "For instructions on how to phrase your request, please say help me.",
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.ask(speechOutput, repromptOutput);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    }
};

function getFinalGuestResponse(inputName, response) {
    makeGuestRequest(inputName, function guestListResponseCallback(err, guestListResponse) {
        var hostName = showData[inputName].Host,
            cardTitle = "Guest info for " + hostName,
            lastName = hostName.toLowerCase().split(' ').slice(-1).join(' '),
            imageFile = {
                smallImageUrl: "https://s3.amazonaws.com/nocturnalninjaimagefiles/" + lastName + "Small.jpg",
                largeImageUrl: "https://s3.amazonaws.com/nocturnalninjaimagefiles/" + lastName + "Large.jpg"
            },
            speechOutput;

        if (err) {
            var speechText = "Sorry, there is currently no guest information available for " + showData[inputName].Show + ",  or it is not on tonight. Please try again tomorrow, or ask about a different show.";
        } else {
            speechText = "Tonight on " + showData[inputName].Show + ", " + showData[inputName].Host + " welcomes to the show " + guestListResponse;
        }
        speechOutput = speechText;
        
        response.tellWithCard(speechOutput, cardTitle, speechOutput, imageFile);
    });
};

function makeGuestRequest(inputName, guestListResponseCallback) {
    
    /**
Get today's date in format to use with API
*/
    var today = new Date(),
        dd = today.getDate(),
        mm = today.getMonth() + 1, //January is 0
        yyyy = today.getFullYear();

        if (dd < 10) {
            dd = '0' + dd;
        } 
        if (mm < 10) {
            mm = '0' + mm;
        }
        today = yyyy + '-' + mm +'-' + dd;

    var http = require('http'),
        options = {
            host: 'api.tvmaze.com',
            path: '/shows/' + showData[inputName].Code + '/episodesbydate?date=' + today
        };
    
    http.request(options, function(response) {
        var showInfoString = '';

        response.on('data', function (guestData) {
        showInfoString += guestData;
        });

        response.on('end', function () {
            var tvMazeResponseObject = JSON.parse(showInfoString); 


            if (tvMazeResponseObject.status) {
                console.error("TV Maze error: " + tvMazeResponseObject.name);
                guestListResponseCallback(new Error(tvMazeResponseObject.name));
            } else {

                // edit the guestList so that it includes 'and' before the last guest name

                var guestList = tvMazeResponseObject[0].name,
                    guestArray = guestList.split(', ');

                if (guestArray.length > 1) {
                        guestList = guestArray.slice(0, -1).join(', ') + " and " + guestArray.slice(-1);
                }
                guestListResponseCallback(null, guestList);
            }
        });
    }).end();
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    var nocturnalNinja = new NocturnalNinja();
    nocturnalNinja.execute(event, context);
};

