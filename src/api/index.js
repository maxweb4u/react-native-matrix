import auth from './endpoints/auth';
import room from './endpoints/room';
import pusher from './endpoints/pusher';
import media from './endpoints/media';
import profile from './endpoints/profile';

class API {
    static auth = auth;

    static room = room;

    static pusher = pusher;

    static media = media;

    static profile = profile;
}
export default API;
